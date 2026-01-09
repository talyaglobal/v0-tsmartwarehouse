'use client';

/**
 * Agreement Modal Component
 * Displays agreement content and handles acceptance
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { AgreementType, AgreementVersion } from '../types';
import { getLatestAgreementVersion, acceptUserAgreement } from '../actions';

interface AgreementModalProps {
  agreementType: AgreementType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept?: () => void;
  userId: string;
  warehouseId?: string;
  bookingId?: string;
  title?: string;
}

export function AgreementModal({
  agreementType,
  open,
  onOpenChange,
  onAccept,
  userId,
  warehouseId,
  bookingId,
  title,
}: AgreementModalProps) {
  const [agreement, setAgreement] = useState<AgreementVersion | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [signatureText, setSignatureText] = useState('');
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && agreementType) {
      loadAgreement();
    }
  }, [open, agreementType]);

  const loadAgreement = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getLatestAgreementVersion(agreementType);
      if (result.success && result.data) {
        setAgreement(result.data);
      } else {
        setError(result.error || 'Failed to load agreement');
      }
    } catch (err) {
      setError('Failed to load agreement');
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom =
      target.scrollHeight - target.scrollTop <= target.clientHeight + 10;
    setScrolledToBottom(isAtBottom);
  };

  const handleAccept = async () => {
    if (!scrolledToBottom || !checked || !signatureText.trim()) {
      return;
    }

    setAccepting(true);
    setError(null);

    try {
      // Import the appropriate accept function based on context
      if (warehouseId) {
        const { acceptWarehouseAgreement } = await import('../actions');
        const result = await acceptWarehouseAgreement({
          agreementType,
          userId,
          warehouseId,
          signatureText,
          signatureMethod: 'typed',
        });
        if (!result.success) {
          setError(result.error || 'Failed to accept agreement');
          return;
        }
      } else if (bookingId) {
        const { acceptBookingAgreement } = await import('../actions');
        const result = await acceptBookingAgreement({
          agreementType,
          userId,
          bookingId,
          signatureText,
          signatureMethod: 'typed',
        });
        if (!result.success) {
          setError(result.error || 'Failed to accept agreement');
          return;
        }
      } else {
        const result = await acceptUserAgreement({
          agreementType,
          userId,
          signatureText,
          signatureMethod: 'typed',
        });
        if (!result.success) {
          setError(result.error || 'Failed to accept agreement');
          return;
        }
      }

      onAccept?.();
      onOpenChange(false);
    } catch (err) {
      setError('Failed to accept agreement');
    } finally {
      setAccepting(false);
    }
  };

  const canAccept = scrolledToBottom && checked && signatureText.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title || agreement?.title || 'Agreement'}</DialogTitle>
          <DialogDescription>
            Please read the agreement carefully before accepting
          </DialogDescription>
        </DialogHeader>

        <ScrollArea
          className="flex-1 min-h-[400px] max-h-[500px] pr-4"
          onScroll={handleScroll}
        >
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p>Loading agreement...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-destructive">{error}</p>
            </div>
          ) : agreement ? (
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
              {agreement.content}
            </div>
          ) : null}
        </ScrollArea>

        {!scrolledToBottom && agreement && (
          <p className="text-sm text-muted-foreground text-center">
            Please scroll to the bottom to continue
          </p>
        )}

        <div className="space-y-4 pt-4 border-t">
          <div className="space-y-2">
            <Label htmlFor="signature">Type your full name to sign</Label>
            <Input
              id="signature"
              placeholder="Your full name"
              value={signatureText}
              onChange={(e) => setSignatureText(e.target.value)}
              disabled={accepting}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="agree"
              checked={checked}
              onCheckedChange={(checked) => setChecked(checked === true)}
              disabled={accepting || !scrolledToBottom}
            />
            <Label
              htmlFor="agree"
              className="text-sm font-normal cursor-pointer"
            >
              I have read and agree to the terms and conditions
            </Label>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={accepting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!canAccept || accepting}
          >
            {accepting ? 'Accepting...' : 'Accept Agreement'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

