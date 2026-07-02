import { ReactNode } from "react";
import { Reveal } from "./reveal";

export function Section({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`py-20 md:py-28 px-6 ${className}`}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Reveal>
      <span className="text-[13px] tracking-[0.3em] uppercase text-lime block mb-5">
        {children}
      </span>
    </Reveal>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <Reveal>
      <h2 className="text-3xl md:text-[44px] font-normal uppercase tracking-tight leading-[1.1]">
        {children}
      </h2>
    </Reveal>
  );
}
