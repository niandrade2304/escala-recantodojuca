"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { identidade } from "@/config/identidade";
import { menu } from "@/config/menu";

export function Cabecalho() {
  const caminho = usePathname();
  return (
    <>
      {/* Faixa branca com a logo inteira (rola junto com a página) */}
      <header className="bg-white">
        <Link
          href="/"
          className="mx-auto flex max-w-3xl items-center justify-center px-4 py-2"
        >
          {identidade.logo ? (
            <Image
              src={identidade.logo}
              alt={identidade.nome}
              width={identidade.logoLargura}
              height={identidade.logoAltura}
              priority
              className="h-auto w-full max-w-[240px]"
            />
          ) : (
            <span className="text-lg font-bold">{identidade.nome}</span>
          )}
        </Link>
      </header>
      {/* Menu na cor principal: fica sempre visível no topo */}
      <nav
        className="sticky top-0 z-10 text-white shadow"
        style={{ background: "var(--cor-principal)" }}
      >
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-2 py-2">
          {menu.map((item) => {
            const ativo = caminho === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-lg px-4 py-2.5 text-base font-semibold ${
                  ativo ? "bg-white/25" : "active:bg-white/10"
                }`}
              >
                {item.rotulo}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
