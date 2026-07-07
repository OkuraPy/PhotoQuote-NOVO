-- F12: the default US contract template hardcodes a deposit/balance <ul> in "3. PAYMENT TERMS",
-- which can't express the new payment plans (full / deposit / installments). Seed a v2 template
-- that is an EXACT copy of 'Service Agreement (United States)' (20260617021500) with ONLY that
-- <ul> replaced by {{payment_schedule_table}} — filled by createAgreement with a Payment/Due/
-- Amount table built from the invoice's stored plan. The old {{deposit_percent}}/{{deposit_amount}}/
-- {{balance_amount}} keys keep working (createAgreement still provides them) for older templates.
-- Guarded by title so the migration is re-runnable without duplicating templates.
do $mig$
begin
  if exists (select 1 from public.contract_templates where title = 'Service Agreement (United States) v2') then
    return;
  end if;

  update public.contract_templates set is_default = false where is_default = true;

  insert into public.contract_templates (state, is_default, title, content, terms_blocks)
  values (
    'US', true, 'Service Agreement (United States) v2',
    $html$<h1 style="text-align:center;color:#11705A;">SERVICE AGREEMENT</h1>
<hr/>

<p>This Service Agreement ("Agreement") is entered into as of <strong>{{date}}</strong>, by and between:</p>

<h3>CONTRACTOR:</h3>
<p><strong>{{company_name}}</strong><br/>
{{company_address}}<br/>
Phone: {{company_phone}} | Email: {{company_email}}<br/>
License #: {{license_number}}</p>

<h3>CLIENT:</h3>
<p><strong>{{client_name}}</strong><br/>
{{client_address}}<br/>
Phone: {{client_phone}} | Email: {{client_email}}</p>

<hr/>

<h3>1. SCOPE OF WORK</h3>
<p>Project: <strong>{{project_name}}</strong><br/>
Service Address: <strong>{{service_address}}</strong><br/>
Service Type: <strong>{{service_type}}</strong></p>

<p>The Contractor agrees to perform the following work, as detailed in Invoice #{{invoice_number}}:</p>

{{line_items_table}}

<h3>2. CONTRACT PRICE</h3>
<p>The total contract price for the work described above shall be: <strong>${{total_amount}}</strong></p>
<p>Subtotal: ${{subtotal}} &nbsp;|&nbsp; Tax ({{tax_rate}}%): ${{tax_amount}}</p>

<h3>3. PAYMENT TERMS</h3>
<p>Payment shall be made as follows:</p>
{{payment_schedule_table}}
<p>Accepted payment methods include card, ACH, check, or other methods agreed upon by both parties.</p>

<h3>4. TIMELINE</h3>
<p>Work is expected to begin within a reasonable period following the signing of this Agreement and receipt of the deposit. The estimated completion timeframe will be communicated upon project start and may be affected by weather, material availability, or change orders.</p>

<h3>5. CHANGE ORDERS</h3>
<p>Any change to the scope of work must be agreed upon in writing by both parties. Additional work will be billed at the rates agreed upon at the time of the change.</p>

<h3>6. WARRANTY</h3>
<p>The Contractor warrants all labor performed for a period of one (1) year from the date of completion against defects in workmanship. Manufacturer warranties, where applicable, apply to materials.</p>

<h3>7. CANCELLATION</h3>
<p>Either party may cancel this Agreement with written notice. If canceled after work has begun, the Client shall pay for all work completed and materials purchased or ordered up to the date of cancellation.</p>

<h3>8. LIABILITY & INSURANCE</h3>
<p>The Contractor shall maintain general liability insurance and any workers compensation coverage required by applicable law in the jurisdiction where the work is performed.</p>

<h3>9. GOVERNING LAW</h3>
<p>This Agreement shall be governed by and construed in accordance with the laws of the state in which the Service Address is located.</p>

<h3>10. ENTIRE AGREEMENT</h3>
<p>This Agreement constitutes the entire understanding between the parties and supersedes all prior discussions. If any provision is held unenforceable, the remaining provisions shall remain in full force and effect.</p>

{{terms_blocks}}

<hr/>

<h3>ACCEPTANCE</h3>
<p>By signing below, both parties agree to the terms and conditions outlined in this Agreement.</p>

<div style="display:flex;justify-content:space-between;margin-top:40px;">
<div style="width:45%;">
<p><strong>CONTRACTOR</strong></p>
<p>{{company_name}}</p>
<p>Date: {{date}}</p>
</div>
<div style="width:45%;">
<p><strong>CLIENT</strong></p>
<p>Signature: ___________________</p>
<p>Name: {{client_name}}</p>
<p>Date: ___________________</p>
</div>
</div>$html$,
    $json$[{"title":"GENERAL TERMS","content":"<ul><li>Unforeseen conditions discovered after work begins (including hidden damage, code violations, or substrate issues not reasonably visible at estimate time) may require a change order and an adjustment to price and timeline.</li><li>The Client is responsible for clearing the work area of personal belongings and providing reasonable access to the site, water, and power as needed.</li><li>The Contractor is not responsible for pre-existing conditions that were not reasonably visible prior to the start of work.</li><li>Permits, where required, will be obtained as agreed; associated fees may be billed to the Client unless already included in the scope above.</li></ul>"}]$json$::jsonb
  );
end
$mig$;
