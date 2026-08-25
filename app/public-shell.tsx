"use client";

import { SafeLink as Link } from "./safe-link";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { ThemeToggle } from "./pwa";

const mainNavigation = [
  ["Início", "/#inicio"], ["Segmentos", "/#segmentos"], ["Recursos", "/#recursos"], ["Como funciona", "/#como-funciona"],
  ["Para quem", "/#para-quem"], ["Planos", "/#planos"], ["Segurança", "/#seguranca"], ["FAQ", "/#faq"],
] as const;

export function Logo({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" aria-label="Agenda Profissa — página inicial" className="flex min-w-0 items-center gap-2.5 sm:gap-3"><span className={`brand-symbol-tile grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-xl p-1 shadow-sm ${inverse ? "brand-symbol-inverse bg-transparent shadow-none" : "bg-[#eaf7f2]"}`}><img src="/brand/agenda-profissa-symbol.png" alt="" aria-hidden="true" className={`h-full w-full object-contain ${inverse ? "brand-symbol-white" : "brand-symbol-adaptive"}`} /></span><span className="min-w-0"><b className={`block text-lg leading-none ${inverse ? "text-white" : "text-[#173f37]"}`}>Agenda Profissa</b><small className={`hidden sm:block ${inverse ? "text-[#b7d5ca]" : "text-[#52675f]"}`}>Seu negócio organizado</small></span></Link>;
}

export function PublicHeader() {
  const [identityVisible, setIdentityVisible] = useState(true);
  const lastScrollY = useRef(0);
  const animationFrame = useRef<number | null>(null);
  const sectionScrollFrame = useRef<number | null>(null);
  const cancelSectionScroll = useRef<(() => void) | null>(null);

  useEffect(() => {
    lastScrollY.current = Math.max(window.scrollY, 0);
    const handleScroll = () => {
      if (animationFrame.current !== null) return;
      animationFrame.current = window.requestAnimationFrame(() => {
        const currentScrollY = Math.max(window.scrollY, 0);
        const movement = currentScrollY - lastScrollY.current;

        if (currentScrollY <= 24) setIdentityVisible(true);
        else if (movement > 3 && currentScrollY > 96) setIdentityVisible(false);
        else if (movement < -3) setIdentityVisible(true);

        lastScrollY.current = currentScrollY;
        animationFrame.current = null;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current);
    };
  }, []);

  useEffect(() => () => cancelSectionScroll.current?.(), []);

  const scrollToSection = (event: ReactMouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || window.location.pathname !== "/") return;

    const sectionId = href.split("#")[1];
    const target = sectionId ? document.getElementById(decodeURIComponent(sectionId)) : null;
    if (!target) return;

    event.preventDefault();
    cancelSectionScroll.current?.();

    const startY = window.scrollY;
    const headerOffset = window.innerWidth < 1024 ? 128 : 88;
    const targetY = Math.max(0, target.getBoundingClientRect().top + startY - headerOffset);
    const distance = targetY - startY;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const updateAddress = () => {
      const method = window.location.hash === `#${sectionId}` ? "replaceState" : "pushState";
      window.history[method](null, "", href);
    };

    if (reducedMotion || Math.abs(distance) < 2) {
      window.scrollTo(0, targetY);
      updateAddress();
      return;
    }

    const duration = Math.min(1050, Math.max(580, 420 + Math.abs(distance) * 0.3));
    let startedAt: number | null = null;
    const removeInterruptListeners = () => {
      window.removeEventListener("wheel", cancelAnimation);
      window.removeEventListener("touchstart", cancelAnimation);
    };
    const cancelAnimation = () => {
      if (sectionScrollFrame.current !== null) window.cancelAnimationFrame(sectionScrollFrame.current);
      sectionScrollFrame.current = null;
      removeInterruptListeners();
      cancelSectionScroll.current = null;
    };
    const animate = (now: number) => {
      if (startedAt === null) startedAt = now;
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - ((-2 * progress + 2) ** 3) / 2;
      window.scrollTo(0, startY + distance * eased);

      if (progress < 1) sectionScrollFrame.current = window.requestAnimationFrame(animate);
      else {
        sectionScrollFrame.current = null;
        removeInterruptListeners();
        cancelSectionScroll.current = null;
        updateAddress();
      }
    };

    cancelSectionScroll.current = cancelAnimation;
    window.addEventListener("wheel", cancelAnimation, { passive: true, once: true });
    window.addEventListener("touchstart", cancelAnimation, { passive: true, once: true });
    sectionScrollFrame.current = window.requestAnimationFrame(animate);
  };

  return <header className={`public-header ${identityVisible ? "public-header-expanded" : "public-header-condensed"} fixed inset-x-0 top-0 z-50 border-b border-[#dfe8e3] bg-[#f8faf7]/95 px-4 backdrop-blur-xl sm:px-6`}><div className="public-header-main mx-auto flex max-w-7xl items-center justify-between"><div className="public-header-brand" aria-hidden={!identityVisible}><Logo/></div><nav aria-label="Navegação principal" className="public-desktop-nav hidden items-center gap-5 xl:flex">{mainNavigation.map(([label,href])=><Link key={href} href={href} onClick={(event) => scrollToSection(event, href)} className="text-sm font-bold text-[#526660] transition hover:text-[#2f7d70]">{label}</Link>)}</nav><div className="public-header-actions flex items-center gap-2" aria-hidden={!identityVisible}><ThemeToggle/><Link href="/sistema" className="hidden min-h-11 items-center rounded-xl px-4 text-sm font-extrabold text-[#2f7d70] sm:inline-flex">Entrar</Link><Link href="/sistema?cadastro=profissional" className="public-create-account inline-flex min-h-11 items-center rounded-xl bg-[#2f7d70] px-3 text-sm font-extrabold text-white shadow-[0_8px_20px_#2f7d7026] hover:bg-[#276b61] sm:px-4">Criar conta</Link></div></div><nav aria-label="Atalhos da página" className="public-mobile-nav -mx-4 flex h-11 items-center gap-1 overflow-x-auto border-t border-[#dfe8e3] px-4 xl:hidden sm:-mx-6 sm:px-6">{mainNavigation.map(([label,href])=><Link key={href} href={href} onClick={(event) => scrollToSection(event, href)} className="flex min-h-8 flex-none items-center rounded-full px-3 text-xs font-extrabold text-[#526660] hover:bg-[#e9f3ef] hover:text-[#2f7d70]">{label}</Link>)}</nav></header>;
}

const legalLinks = [
  ["Centro jurídico", "/legal"], ["Termos de uso", "/termos"], ["Privacidade", "/privacidade"], ["Cookies", "/cookies"],
  ["Diretrizes", "/diretrizes"], ["Segurança", "/seguranca"], ["Direitos do titular", "/direitos-do-titular"],
];

export function PublicFooter() {
  return <footer className="public-footer bg-[#122f29] px-4 py-14 text-white sm:px-6"><div className="mx-auto max-w-7xl"><div className="grid gap-10 border-b border-white/10 pb-10 md:grid-cols-[1.2fr_.8fr_.8fr]"><div><Logo inverse/><p className="mt-5 max-w-sm text-sm leading-6 text-[#abc5bd]">Gestão de agendamentos para profissionais e negócios que cuidam de pessoas.</p></div><div><h2 className="text-sm font-extrabold">Produto</h2><div className="mt-4 grid gap-3 text-sm text-[#abc5bd]"><Link href="/#recursos">Recursos</Link><Link href="/#como-funciona">Como funciona</Link><Link href="/#planos">Planos</Link><Link href="/faq">Perguntas frequentes</Link><Link href="/sistema">Acessar sistema</Link></div></div><div><h2 className="text-sm font-extrabold">Acesso seguro</h2><p className="mt-4 max-w-xs text-sm leading-6 text-[#abc5bd]">Entre no sistema para acessar sua agenda e os canais disponíveis para o seu perfil.</p></div></div><div className="flex flex-col gap-3 pt-7 text-xs text-[#8faea5] sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} Agenda Profissa. Ambiente de MVP.</p><p>Assinaturas em reais processadas pelo Mercado Pago.</p></div></div></footer>;
}

export { legalLinks };
