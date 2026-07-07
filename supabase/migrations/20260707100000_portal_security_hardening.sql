-- Portal security hardening (diagnóstico 07/07 — PORTAL_100_PLAN P1):
-- 1) contract-signatures: anyone on the internet could UPLOAD AND OVERWRITE files
--    ("Anyone can update signatures" policy, role public, bucket-only check).
--    Signature images are legal evidence — overwriting one after signing = tampering.
--    Drop the UPDATE policy; keep INSERT (the signing flow uploads once, unique path, no upsert).
drop policy if exists "Anyone can update signatures" on storage.objects;

-- 2) get_project_by_share_token: the RPC returned estimateTotal ALWAYS, ignoring the
--    show_values flag the contractor sets on the share link. Gate it server-side.
CREATE OR REPLACE FUNCTION public.get_project_by_share_token(p_token text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_token_row RECORD;
  v_project RECORD;
  v_contractor RECORD;
  v_client RECORD;
  v_phases JSON;
  v_result JSON;
BEGIN
  -- 1. Validate token
  SELECT * INTO v_token_row
  FROM project_share_tokens
  WHERE token = p_token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Update last_accessed_at
  UPDATE project_share_tokens
  SET last_accessed_at = now()
  WHERE id = v_token_row.id;

  -- 2. Get project
  SELECT * INTO v_project
  FROM projects
  WHERE id = v_token_row.project_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- 3. Get contractor (user) info
  SELECT * INTO v_contractor
  FROM users
  WHERE id = v_project.user_id;

  -- 4. Get client info
  SELECT * INTO v_client
  FROM clients
  WHERE id = v_project.client_id;

  -- 5. Get phases with photos and comments (client-visible phases only)
  SELECT json_agg(phase_data ORDER BY phase_data.phase_order) INTO v_phases
  FROM (
    SELECT
      pp.id,
      pp.name,
      pp.phase_order,
      pp.status,
      COALESCE(pp.notes, '') AS notes,
      pp.expected_completion_date,
      pp.actual_completion_date,
      pp.is_visible_to_client,
      COALESCE(
        (SELECT json_agg(photo_row ORDER BY photo_row.display_order)
         FROM (
           SELECT ph.id, ph.file_url, COALESCE(ph.caption, '') AS caption, ph.display_order, ph.created_at
           FROM phase_photos ph
           WHERE ph.phase_id = pp.id
         ) photo_row),
        '[]'::json
      ) AS photos,
      COALESCE(
        (SELECT json_agg(comment_row ORDER BY comment_row.created_at)
         FROM (
           SELECT pc.id, pc.author_type, COALESCE(pc.author_name, '') AS author_name, pc.content, pc.created_at
           FROM phase_comments pc
           WHERE pc.phase_id = pp.id
         ) comment_row),
        '[]'::json
      ) AS comments
    FROM project_phases pp
    WHERE pp.project_id = v_token_row.project_id
      AND pp.is_visible_to_client = true
  ) phase_data;

  -- 6. Build result — estimateTotal only when the contractor allows showing values
  v_result := json_build_object(
    'projectName', v_project.name,
    'clientName', COALESCE(v_client.full_name, ''),
    'contractorName', COALESCE(v_contractor.company_name, ''),
    'contractorLogo', v_contractor.logo_url,
    'contractorPhone', COALESCE(v_contractor.company_phone, ''),
    'contractorEmail', COALESCE(v_contractor.email, ''),
    'address', COALESCE(v_project.address, ''),
    'city', COALESCE(v_project.city, ''),
    'zip', COALESCE(v_project.zip, ''),
    'status', COALESCE(v_project.status, ''),
    'activatedAt', v_project.activated_at,
    'showValues', v_token_row.show_values,
    'estimateTotal', CASE WHEN COALESCE(v_token_row.show_values, true)
      THEN (SELECT total FROM estimates WHERE id = v_project.activated_estimate_id)
      ELSE NULL END,
    'phases', COALESCE(v_phases, '[]'::json)
  );

  RETURN v_result;
END;
$function$;

-- 3) add_client_comment: no size caps and free-form author name (impersonation/spam).
--    Cap content/author, force author fallback, and add a simple per-project flood guard.
CREATE OR REPLACE FUNCTION public.add_client_comment(p_token text, p_phase_id uuid, p_author_name text, p_content text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_token_row RECORD;
  v_phase RECORD;
  v_comment RECORD;
  v_author text;
  v_content text;
  v_recent int;
BEGIN
  -- 0. Input caps (server-side; the portal also validates)
  v_content := btrim(COALESCE(p_content, ''));
  IF length(v_content) = 0 THEN
    RETURN json_build_object('error', 'Empty comment');
  END IF;
  IF length(v_content) > 2000 THEN
    RETURN json_build_object('error', 'Comment too long');
  END IF;
  v_author := left(COALESCE(NULLIF(btrim(p_author_name), ''), 'Client'), 80);

  -- 1. Validate token
  SELECT * INTO v_token_row
  FROM project_share_tokens
  WHERE token = p_token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Invalid or expired token');
  END IF;

  -- 1b. Flood guard: max 20 client comments per project per 10 minutes
  SELECT count(*) INTO v_recent
  FROM phase_comments
  WHERE project_id = v_token_row.project_id
    AND author_type = 'client'
    AND created_at > now() - interval '10 minutes';
  IF v_recent >= 20 THEN
    RETURN json_build_object('error', 'Too many comments, try again later');
  END IF;

  -- 2. Validate phase belongs to this project
  SELECT * INTO v_phase
  FROM project_phases
  WHERE id = p_phase_id
    AND project_id = v_token_row.project_id
    AND is_visible_to_client = true;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Phase not found');
  END IF;

  -- 3. Insert comment
  INSERT INTO phase_comments (phase_id, project_id, author_type, author_name, content)
  VALUES (p_phase_id, v_token_row.project_id, 'client', v_author, v_content)
  RETURNING * INTO v_comment;

  RETURN json_build_object(
    'id', v_comment.id,
    'phaseId', v_comment.phase_id,
    'authorType', v_comment.author_type,
    'authorName', COALESCE(v_comment.author_name, ''),
    'content', v_comment.content,
    'createdAt', v_comment.created_at
  );
END;
$function$;

-- 4) Two seeded TEST agreements with predictable tokens were still signable in production.
--    Void them (sign_agreement only signs status IN ('sent','pending_signature')).
UPDATE agreements SET status = 'void', updated_at = now()
WHERE token IN ('agr_test_0ffa304d020d20f8', 'test_agreement_token_2026_demo')
  AND status IN ('sent', 'pending_signature');
