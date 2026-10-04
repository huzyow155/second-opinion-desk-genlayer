import React, { useEffect } from 'react';
import {
  Scale,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Zap,
} from 'lucide-react';

interface LandingPageProps {
  onLaunchApp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchApp }) => {
  const heroWordsLine1 = ['What', 'if', 'your', 'on-chain', 'judge'];
  const heroWordsLine2 = ['changed', 'its', 'mind', 'just', 'because'];
  const heroWordsLine3 = ['you', 'asked'];

  // Scroll-following light sweep & viewport entrance observer
  useEffect(() => {
    const sweepElements = document.querySelectorAll<HTMLElement>('.text-sweep');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('swept');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.3,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    sweepElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen py-12 sm:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20 sm:space-y-28">
        {/* Hero Section */}
        <section className="text-center max-w-4xl mx-auto space-y-7">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium silver-pill reveal-fade" style={{ '--reveal-delay': '100ms' } as React.CSSProperties}>
            <Sparkles className="w-3.5 h-3.5 text-stone-300" />
            <span>Position-Invariant Adjudication on GenLayer Studionet Preview</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-[#eef0f2] tracking-tight leading-[1.08] text-sweep">

            <span className="block mb-1 sm:mb-2">
              {heroWordsLine1.map((w, i) => (
                <span
                  key={w}
                  className="hero-word-reveal mr-2.5 sm:mr-3.5"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {w}
                </span>
              ))}
            </span>
            <span className="block mb-1 sm:mb-2">
              {heroWordsLine2.map((w, i) => (
                <span
                  key={w}
                  className="hero-word-reveal mr-2.5 sm:mr-3.5"
                  style={{ animationDelay: `${(heroWordsLine1.length + i) * 60}ms` }}
                >
                  {w}
                </span>
              ))}
            </span>
            <span className="block">
              {heroWordsLine3.map((w, i) => (
                <span
                  key={w}
                  className="hero-word-reveal mr-2.5 sm:mr-3.5"
                  style={{
                    animationDelay: `${(heroWordsLine1.length + heroWordsLine2.length + i) * 60}ms`,
                  }}
                >
                  {w}
                </span>
              ))}
              <span
                className="hero-word-reveal text-gradient-silver underline decoration-white/20 underline-offset-8"
                style={{
                  animationDelay: `${(heroWordsLine1.length + heroWordsLine2.length + heroWordsLine3.length) * 60}ms`,
                }}
              >
                in reverse?
              </span>
            </span>
          </h1>

          <p className="text-base sm:text-xl text-[#9fa5b0] max-w-2xl mx-auto leading-relaxed">
            Large language models are inherently vulnerable to position bias: swapping the order of
            parties or evidence systematically flips verdicts. Second-Opinion Desk introduces
            dual-pass mirrored adjudication, refusing to accept any verdict that cannot survive its
            own mirror image.
          </p>

          <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onLaunchApp}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-9 py-4 rounded-xl text-base font-bold btn-silver-primary cursor-pointer shadow-lg"
            >
              <span>Launch Dispute Workbench</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* The Position-Bias Flaw Diagram */}
        <section className="silver-frame-raised p-6 sm:p-10 space-y-8">
          <div className="max-w-2xl mx-auto text-center space-y-2">
            <div className="text-xs font-bold text-stone-400 uppercase tracking-widest">
              The Fundamental Problem
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#eef0f2] text-sweep">
              Why Single-Pass LLM Arbitration Fails
            </h2>
            <p className="text-sm sm:text-base text-[#9fa5b0] reveal-fade">
              Academic benchmarks reveal that commercial LLMs frequently favor whichever party is
              presented first, or switch outcomes when party aliases are swapped.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Flawed Single-Pass Approach */}
            <div className="silver-frame-inset p-6 space-y-4 stagger-item" style={{ '--reveal-delay': '100ms' } as React.CSSProperties}>
              <div className="flex items-center gap-2 text-stone-300 font-bold text-sm sm:text-base">
                <div className="w-5 h-5 rounded-md bg-stone-800 text-stone-400 flex items-center justify-center text-xs">
                  X
                </div>
                <span>Conventional Single-Pass LLM Judge</span>
              </div>
              <p className="text-xs sm:text-sm text-[#9fa5b0] leading-relaxed">
                An LLM is asked once: &quot;Who should win: Party A or Party B?&quot; Even with identical facts,
                an order flip flips the outcome up to 28% of the time. A committee of biased validators
                prompted identically achieves consensus on an arbitrary result.
              </p>
              <div className="p-3.5 bg-red-950/30 border border-red-500/20 rounded-xl text-xs sm:text-sm text-red-300/90 font-mono leading-relaxed">
                Prompt(A, B) &rarr; Favors A (62%) <br />
                Prompt(B, A) &rarr; Favors B (59%) [Order Flip]
              </div>
            </div>

            {/* MirrorJudge Solution */}
            <div className="silver-frame p-6 space-y-4 border-white/[0.18] stagger-item" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
              <div className="flex items-center gap-2 text-[#eef0f2] font-bold text-sm sm:text-base">
                <div className="w-5 h-5 rounded-md bg-white/[0.12] text-white flex items-center justify-center text-xs">
                  ✓
                </div>
                <span>MirrorJudge Dual-Pass Adjudication</span>
              </div>
              <p className="text-xs sm:text-sm text-[#9fa5b0] leading-relaxed">
                Evaluates every dispute twice: first canonically, then mirrored (parties swapped, criteria
                reversed, evidence shuffled). If the score delta exceeds the strict margin or criterion
                decisions flip, the verdict is flagged as UNSTABLE.
              </p>
              <div className="p-3.5 bg-white/[0.04] border border-white/[0.12] rounded-xl text-xs sm:text-sm text-[#eef0f2] font-mono leading-relaxed">
                Canonical Pass: Party 1 Score = 72% <br />
                Mirrored Pass: Party 1 Score = 71% &rarr; STABLE (&le;15% delta)
              </div>
            </div>
          </div>
        </section>

        {/* 3 Pillars: How It Works */}
        <section className="space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <div className="text-xs font-bold text-stone-400 uppercase tracking-widest">
              Core Principles
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#eef0f2] text-sweep">
              Three Guarantees for Autonomous Disputes
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="silver-frame p-6 space-y-3.5 stagger-item" style={{ '--reveal-delay': '100ms' } as React.CSSProperties}>
              <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.10] text-[#eef0f2] flex items-center justify-center">
                <Scale className="w-4.5 h-4.5" />
              </div>
              <h3 className="font-bold text-[#eef0f2] text-base sm:text-lg">Deterministic Party Mirroring</h3>
              <p className="text-xs sm:text-sm text-[#9fa5b0] leading-relaxed">
                Deterministic anonymization replaces human identifiers with neutral placeholders. The
                mirrored pass systematically inverts every position parameter to nullify ordering bias.
              </p>
            </div>

            <div className="silver-frame p-6 space-y-3.5 stagger-item" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
              <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.10] text-[#eef0f2] flex items-center justify-center">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
              <h3 className="font-bold text-[#eef0f2] text-base sm:text-lg">Verbatim Quote Grounding</h3>
              <p className="text-xs sm:text-sm text-[#9fa5b0] leading-relaxed">
                The intelligent contract rejects LLM hallucinations by requiring verbatim quote citations
                from the entered evidence. Speculative reasoning without textual evidence receives zero weight.
              </p>
            </div>

            <div className="silver-frame p-6 space-y-3.5 stagger-item" style={{ '--reveal-delay': '300ms' } as React.CSSProperties}>
              <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.10] text-[#eef0f2] flex items-center justify-center">
                <Cpu className="w-4.5 h-4.5" />
              </div>
              <h3 className="font-bold text-[#eef0f2] text-base sm:text-lg">GenLayer Validator Consensus</h3>
              <p className="text-xs sm:text-sm text-[#9fa5b0] leading-relaxed">
                Conventional blockchains cannot run non-deterministic AI models. GenLayer’s GenVM validator
                consensus executes Intelligent Contracts across independent validators to reach verified state agreement.
              </p>
            </div>
          </div>
        </section>

        {/* Why GenLayer Section */}
        <section className="silver-frame-inset p-8 sm:p-10 space-y-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium silver-pill">
              <Zap className="w-3.5 h-3.5 text-stone-300" />
              <span>Infrastructure Architecture</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#eef0f2] text-sweep">
              Why GenLayer is Mandatory for MirrorJudge
            </h2>
            <p className="text-sm sm:text-base text-[#9fa5b0] leading-relaxed reveal-fade">
              Standard EVM smart contracts cannot read natural language or perform semantic reasoning.
              Centralized oracle services introduce single points of failure. GenLayer solves this by
              allowing Python intelligent contracts to call natural-language processing directly inside the
              GenVM execution runtime, protected by validator majority consensus.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <div className="bg-[#121417]/90 p-4 rounded-xl border border-white/[0.08] shadow-xs stagger-item" style={{ '--reveal-delay': '100ms' } as React.CSSProperties}>
              <div className="text-xs font-mono text-stone-300 font-bold mb-1">01 / GenVM Python</div>
              <div className="text-xs text-[#9fa5b0]">Native Python execution runtime with pure string storage</div>
            </div>
            <div className="bg-[#121417]/90 p-4 rounded-xl border border-white/[0.08] shadow-xs stagger-item" style={{ '--reveal-delay': '180ms' } as React.CSSProperties}>
              <div className="text-xs font-mono text-stone-300 font-bold mb-1">02 / Dual-Pass Consensus</div>
              <div className="text-xs text-[#9fa5b0]">Validators evaluate both passes before committing state</div>
            </div>
            <div className="bg-[#121417]/90 p-4 rounded-xl border border-white/[0.08] shadow-xs stagger-item" style={{ '--reveal-delay': '260ms' } as React.CSSProperties}>
              <div className="text-xs font-mono text-stone-300 font-bold mb-1">03 / Zero Gas Price</div>
              <div className="text-xs text-[#9fa5b0]">Transactions use 0 gas price on Studionet Preview</div>
            </div>
            <div className="bg-[#121417]/90 p-4 rounded-xl border border-white/[0.08] shadow-xs stagger-item" style={{ '--reveal-delay': '340ms' } as React.CSSProperties}>
              <div className="text-xs font-mono text-stone-300 font-bold mb-1">04 / Composable Consumer</div>
              <div className="text-xs text-[#9fa5b0]">Downstream contracts read certificates to trigger automated settlements</div>
            </div>
          </div>
        </section>

        {/* Call to Action Banner */}
        <section className="text-center py-12 px-6 silver-frame-raised space-y-4">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#eef0f2] text-sweep">
            Ready to test bias-cancelled dispute resolution?
          </h2>
          <p className="text-sm sm:text-base text-[#9fa5b0] max-w-lg mx-auto reveal-fade">
            Browse real on-chain cases without a wallet, or connect to Studionet to open a fresh dispute.
          </p>
          <div>
            <button
              onClick={onLaunchApp}
              className="inline-flex items-center gap-2 px-9 py-3.5 rounded-xl text-sm sm:text-base font-bold btn-silver-primary cursor-pointer shadow-md"
            >
              <span>Enter Second-Opinion Desk</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
