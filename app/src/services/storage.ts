import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const getMimeType = (ext: string): string => {
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', gif: 'image/gif', heic: 'image/jpeg',
  };
  return map[ext] || 'image/jpeg';
};

/**
 * Convert any image (including HEIC) to JPEG using expo-image-manipulator
 */
async function ensureJpeg(uri: string): Promise<string> {
  try {
    const result = await manipulateAsync(uri, [], {
      compress: 0.8,
      format: SaveFormat.JPEG,
    });
    return result.uri;
  } catch (error) {
    console.warn('Failed to convert image to JPEG, using original:', error);
    return uri;
  }
}

export const storageService = {
  /**
   * Upload company logo
   * Bucket: company-logos
   * Path: {user_id}/logo.jpg
   */
  async uploadLogo(userId: string, localUri: string): Promise<string> {
    try {
      const fileName = `${userId}/logo.jpg`;
      const fileExtension = localUri.split('.').pop()?.toLowerCase() || 'jpg';

      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: 'base64' as const,
      });

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('company-logos')
        .upload(fileName, decode(base64), {
          contentType: getMimeType(fileExtension),
          upsert: true, // Replace existing logo
        });

      if (error) throw error;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      throw error;
    }
  },

  /**
   * Upload project photo
   * Bucket: project-photos
   * Path: {user_id}/{project_id}/{photo_id}.jpg
   */
  async uploadProjectPhoto(
    userId: string,
    projectId: string,
    localUri: string,
    photoId: string
  ): Promise<string> {
    try {
      // Always convert to JPEG (handles HEIC, PNG, etc.)
      const jpegUri = await ensureJpeg(localUri);
      const fileName = `${userId}/${projectId}/${photoId}.jpg`;

      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(jpegUri, {
        encoding: 'base64' as const,
      });

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('project-photos')
        .upload(fileName, decode(base64), {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('project-photos')
        .getPublicUrl(fileName);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('Error uploading project photo:', error);
      throw error;
    }
  },

  /**
   * Upload PDF (estimate or invoice)
   * Bucket: estimate-pdfs
   * Path: {user_id}/{estimate_id}.pdf
   */
  async uploadPDF(userId: string, estimateId: string, localUri: string): Promise<string> {
    try {
      const fileName = `${userId}/${estimateId}.pdf`;

      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: 'base64' as const,
      });

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('estimate-pdfs')
        .upload(fileName, decode(base64), {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (error) throw error;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('estimate-pdfs')
        .getPublicUrl(fileName);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('Error uploading PDF:', error);
      throw error;
    }
  },

  /**
   * Delete project photo
   * Bucket: project-photos
   * Path: {user_id}/{project_id}/{photo_id}.jpg
   */
  async deleteProjectPhoto(
    userId: string,
    projectId: string,
    photoId: string
  ): Promise<void> {
    try {
      // Try common extensions
      const extensions = ['jpg', 'jpeg', 'png', 'webp'];

      for (const ext of extensions) {
        const fileName = `${userId}/${projectId}/${photoId}.${ext}`;
        const { error } = await supabase.storage
          .from('project-photos')
          .remove([fileName]);

        if (!error) break; // Successfully deleted
      }
    } catch (error) {
      console.error('Error deleting project photo:', error);
      throw error;
    }
  },

  /**
   * Delete company logo
   * Bucket: company-logos
   * Path: {user_id}/logo.jpg
   */
  async deleteLogo(userId: string): Promise<void> {
    try {
      const fileName = `${userId}/logo.jpg`;
      const { error } = await supabase.storage
        .from('company-logos')
        .remove([fileName]);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting logo:', error);
      throw error;
    }
  },
};
