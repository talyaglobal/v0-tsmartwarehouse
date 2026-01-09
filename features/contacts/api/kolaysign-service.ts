/**
 * KolaySign Service
 * Handles all KolaySign API interactions for document signing and signature workflows
 */

import { KolaySignConfig, KolaySignDocument, KolaySignResponse } from '../types';
import { createHmac } from 'crypto';

export class KolaySignService {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor(config: KolaySignConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.baseUrl = config.baseUrl || 'https://api.kolaysign.com';
  }

  /**
   * Generate authorization header for KolaySign API requests
   */
  private getAuthHeaders(): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.generateSignature(timestamp);

    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      'X-Timestamp': timestamp.toString(),
      'X-Signature': signature,
    };
  }

  /**
   * Generate HMAC signature for API authentication
   */
  private generateSignature(timestamp: number): string {
    const message = `${this.apiKey}${timestamp}`;
    return createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('hex');
  }

  /**
   * Create a signature request in KolaySign
   * @param document - Document to be signed
   * @returns KolaySign response with signing URL
   */
  async createSignatureRequest(
    document: KolaySignDocument
  ): Promise<KolaySignResponse> {
    try {
      const payload = {
        name: document.name,
        signers: document.signers,
        content: document.content,
        metadata: document.metadata || {},
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/kolaysign`,
      };

      const response = await fetch(`${this.baseUrl}/api/v1/documents`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`KolaySign API error: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      return {
        success: true,
        data: {
          documentId: data.id,
          signingUrl: data.signingUrl,
          expiresAt: data.expiresAt,
        },
      };
    } catch (error) {
      console.error('KolaySign createSignatureRequest error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get signature request status from KolaySign
   * @param documentId - KolaySign document ID
   * @returns Document status and signature information
   */
  async getSignatureStatus(documentId: string): Promise<KolaySignResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/documents/${documentId}`,
        {
          method: 'GET',
          headers: this.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`KolaySign API error: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      return {
        success: true,
        data: {
          status: data.status,
          signers: data.signers,
          signedAt: data.signedAt,
          signedDocumentUrl: data.signedDocumentUrl,
        },
      };
    } catch (error) {
      console.error('KolaySign getSignatureStatus error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Cancel a signature request
   * @param documentId - KolaySign document ID
   * @returns Cancellation response
   */
  async cancelSignatureRequest(documentId: string): Promise<KolaySignResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/documents/${documentId}/cancel`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`KolaySign API error: ${response.statusText} - ${errorText}`);
      }

      return {
        success: true,
        message: 'Signature request cancelled successfully',
      };
    } catch (error) {
      console.error('KolaySign cancelSignatureRequest error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Download signed document from KolaySign
   * @param documentId - KolaySign document ID
   * @returns Signed document URL or buffer
   */
  async downloadSignedDocument(documentId: string): Promise<KolaySignResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/documents/${documentId}/download`,
        {
          method: 'GET',
          headers: this.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`KolaySign API error: ${response.statusText} - ${errorText}`);
      }

      const buffer = await response.arrayBuffer();

      return {
        success: true,
        data: {
          buffer,
          contentType: response.headers.get('content-type'),
        },
      };
    } catch (error) {
      console.error('KolaySign downloadSignedDocument error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Resend signing invitation to a signer
   * @param documentId - KolaySign document ID
   * @param signerEmail - Email of the signer
   * @returns Resend response
   */
  async resendSigningInvitation(
    documentId: string,
    signerEmail: string
  ): Promise<KolaySignResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/documents/${documentId}/resend`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ signerEmail }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`KolaySign API error: ${response.statusText} - ${errorText}`);
      }

      return {
        success: true,
        message: 'Signing invitation sent successfully',
      };
    } catch (error) {
      console.error('KolaySign resendSigningInvitation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Verify webhook signature from KolaySign
   * @param payload - Webhook payload
   * @param signature - Webhook signature
   * @returns Verification result
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = createHmac('sha256', this.apiSecret)
        .update(payload)
        .digest('hex');

      return expectedSignature === signature;
    } catch (error) {
      console.error('KolaySign verifyWebhookSignature error:', error);
      return false;
    }
  }
}

/**
 * Initialize KolaySign service with environment variables
 */
export function initializeKolaySignService(): KolaySignService {
  const config: KolaySignConfig = {
    apiKey: process.env.KOLAYSIGN_API_KEY || '',
    apiSecret: process.env.KOLAYSIGN_API_SECRET || '',
    baseUrl: process.env.KOLAYSIGN_BASE_URL || 'https://api.kolaysign.com',
    webhookSecret: process.env.KOLAYSIGN_WEBHOOK_SECRET,
  };

  if (!config.apiKey || !config.apiSecret) {
    throw new Error(
      'KolaySign API credentials not configured. Please set KOLAYSIGN_API_KEY and KOLAYSIGN_API_SECRET environment variables.'
    );
  }

  return new KolaySignService(config);
}

