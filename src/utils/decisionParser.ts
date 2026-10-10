/**
 * Pure decision parser for MirrorJudge on-chain stability certificates.
 * Splits on '|' and switches on exact tokens:
 * - DECIDED|PARTY_1|STABLE
 * - DECIDED|PARTY_2|STABLE
 * - DECIDED|SPLIT|STABLE
 * - UNSTABLE|NONE|UNSTABLE
 * - INSUFFICIENT|NONE|NA
 */

export interface ParsedDecision {
  raw: string;
  status: 'DECIDED' | 'UNSTABLE' | 'INSUFFICIENT' | 'PENDING' | 'UNKNOWN';
  winner: 'PARTY_1' | 'PARTY_2' | 'SPLIT' | 'NONE';
  stability: 'STABLE' | 'UNSTABLE' | 'NA';
  label: string;
  badgeType: 'stable' | 'unstable' | 'insufficient' | 'split' | 'pending';
  certificateTitle: string;
  explanation: string;
}

export function parseDecision(rawDecision?: string | null): ParsedDecision {
  const raw = (rawDecision || '').trim();

  if (!raw) {
    return {
      raw: '',
      status: 'PENDING',
      winner: 'NONE',
      stability: 'NA',
      label: 'Pending Evaluation',
      badgeType: 'pending',
      certificateTitle: 'STATUS PENDING',
      explanation: 'Awaiting initial dual-pass mirrored adjudication.',
    };
  }

  const parts = raw.split('|');
  const statusToken = parts[0]?.toUpperCase() || '';
  const winnerToken = (parts[1]?.toUpperCase() || 'NONE') as 'PARTY_1' | 'PARTY_2' | 'SPLIT' | 'NONE';
  const stabilityToken = (parts[2]?.toUpperCase() || 'NA') as 'STABLE' | 'UNSTABLE' | 'NA';

  // 1. DECIDED branch
  if (statusToken === 'DECIDED') {
    const effectiveStability: 'STABLE' | 'UNSTABLE' | 'NA' =
      stabilityToken === 'STABLE'
        ? 'STABLE'
        : stabilityToken === 'UNSTABLE'
          ? 'UNSTABLE'
          : 'NA';
    const isStable = effectiveStability === 'STABLE';
    const isSplit = winnerToken === 'SPLIT';

    let explanation = 'Dispute decided by consensus.';
    if (!isStable) {
      explanation = 'Outcome reached a tentative winner token but stability is not confirmed.';
    } else if (winnerToken === 'PARTY_1') {
      explanation = 'Both evaluation passes favored Party 1 within the configured tolerance.';
    } else if (winnerToken === 'PARTY_2') {
      explanation = 'Both evaluation passes favored Party 2 within the configured tolerance.';
    } else if (winnerToken === 'SPLIT') {
      explanation = 'Both parties fulfilled reciprocal obligations, landing within the margin threshold.';
    }

    return {
      raw,
      status: 'DECIDED',
      winner: winnerToken,
      stability: effectiveStability,
      label: isSplit
        ? `DECIDED · SPLIT · ${effectiveStability}`
        : `DECIDED · ${winnerToken.replace('_', ' ')} · ${effectiveStability}`,
      badgeType: !isStable ? 'unstable' : isSplit ? 'split' : 'stable',
      certificateTitle: !isStable
        ? 'UNSTABLE CERTIFICATE'
        : isSplit
          ? 'SPLIT DETERMINATION'
          : 'STABLE CERTIFICATE',
      explanation,
    };
  }

  // 2. UNSTABLE branch - MUST NEVER match STABLE
  if (statusToken === 'UNSTABLE') {
    return {
      raw,
      status: 'UNSTABLE',
      winner: 'NONE',
      stability: 'UNSTABLE',
      label: 'UNSTABLE',
      badgeType: 'unstable',
      certificateTitle: 'UNSTABLE CERTIFICATE',
      explanation: 'The mirrored evaluation changed the outcome enough to require another round or additional evidence.',
    };
  }

  // 3. INSUFFICIENT branch
  if (statusToken === 'INSUFFICIENT') {
    return {
      raw,
      status: 'INSUFFICIENT',
      winner: 'NONE',
      stability: 'NA',
      label: 'INSUFFICIENT EVIDENCE',
      badgeType: 'insufficient',
      certificateTitle: 'INSUFFICIENT EVIDENCE',
      explanation: 'One or both parties do not yet have enough submitted evidence for adjudication.',
    };
  }

  // 4. Fallback unknown
  return {
    raw,
    status: 'UNKNOWN',
    winner: 'NONE',
    stability: 'NA',
    label: raw,
    badgeType: 'pending',
    certificateTitle: raw,
    explanation: 'Adjudication completed.',
  };
}
