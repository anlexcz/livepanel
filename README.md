# Metrobus LivePanel

Vývojový prototyp administrace pro živou režii Metrobusu. **Momentálně pouze frontend s lokálními mock daty. Není připojen k YouTube, OBS ani produkčnímu serveru.**

## Lokální spuštění

Požadavky: Node.js 20.19+ nebo novější kompatibilní s Vite 6, npm.

```bash
npm install
npm run dev
```

Sestavení: `npm run build`; náhled sestavení: `npm run preview`.

## Stav vývoje

Vizuální UI prototyp: tmavá administrace, navigace, stavová lišta a živá režie REŽIE 60 % vlevo / CHAT 40 % vpravo, včetně tažení hranice a mobilního přepínání. FEATURED, EVENT, TICKER a EDITORIAL mají testovací ovládání, knihovny a fronty. Samostatné stránky INTRO, BREAK a OUTRO nabízejí editor a testovací náhled; archiv umělých komentářů podporuje datumové filtry a export ukázkových CSV/JSON; diagnostika a nastavení mají interaktivní demonstrační obrazovky. Prototyp neslouží k řízení skutečné produkce.

Lokální demo změny se mohou při obnovení stránky ztratit; výjimkou je poměr sloupců scénických editorů uložený v místním prohlížeči. Scénické náhledy nemají skutečné animace ani zvuk, přehrávací ovladače pouze ilustrují UX. Žádný backend ani produkční časovače.

Vzhled vychází z dokumentu „Metrobus LivePanel – UI/UX Design a chování“ (13. 11. 2026). Fonty Audiowide, Montserrat a Inter se při instalaci přibalí lokálně prostřednictvím @fontsource. Používáme Lucide ikony. Mock data jsou v `src/mock/`.

**Pozor:** Lokální mock stav není serverový Production State. Žádné akce nevysílají do OBS. Osobní preference a skutečná produkční synchronizace budou implementovány později.


## Layout Wizard – schválená revize 14. 11. 2026

- Desktop nabízí režim **2 sloupce** (REŽIE 60 % / CHAT 40 %) a na širokém monitoru **3 sloupce** (TICKER+EDITORIAL 25 % / FEATURED+EVENT 35 % / CHAT 40 %). Tři sloupce jsou na široké obrazovce preferované, režim lze ručně přepnout.
- Sloupce mají nezávislý scroll a přetahovatelné hranice; dvojklik na hranici obnoví výchozí poměry.
- Desktopový levý rail se rozšiřuje jako součást layoutu místo překryvné vrstvy. Mobil používá dosavadní overlay. INTRO/BREAK/OUTRO jsou v rozšířené navigaci samostatně viditelné.
- Horní lišta používá oficiální `znak_MB_bily.png` jako lokálně uložený `public/assets/metrobus-mark-white.png`. Favicon pochází z `znak_MB_vypln_bile.png`.
- Výběr layoutu a velikosti sloupců jsou v této vývojové verzi uloženy pouze v `localStorage` prohlížeče. Není to ještě uživatelský profil na serveru.
- Přesný breakpoint a minimální šířky jsou prototypové hodnoty k ověření při vizuálním testování, nikoli součást produkčního kontraktu.

## Dokumentace

- [Hlavní koncepce](https://docs.google.com/document/d/1SYBHHQ58sdE3D_rJCb9AjMw0TO9JvJ9G5qU-WEvxd4I/edit)
- [UI/UX Design](https://docs.google.com/document/d/1erayGTEZqUEs3jQl-8oCz5OItgiqMVyHbkveZpKLQuQ/edit)
- [Technická architektura](https://docs.google.com/document/d/1I-1_TYF-PH_NHz2NtYZNxhDiBdRsXpBZyOpSMGKi1J8/edit)


## Scénické editory – funkční klientský demo náhled (14. 11. 2026)

- **INTRO**: jeden volitelný název, lokální animace s 1,5s prodlevou, cca 20s sekvencí a tichou vizuální smyčkou. Hudební synchronizace a produkční OBS overlay nejsou součástí prototypu.
- **BREAK**: dvě skutečně pohybující se CSS glow pozadí, nadpis, přepínač doplňujícího textu, lokální odpočet pevnou délkou nebo do dnešního cílového času, pauza/pokračování/reset/konec a text po dokončení. „Obnovit výchozí“ mění jen rozepsanou konfiguraci.
- **OUTRO**: rozšiřitelný registr šablon s jedinou ověřenou referencí Pokec z `anlexcz/studio/outro`; vlastní pole účinkujících, textů, odkazů, hlášek a Forendors. Lokální ukázková sekvence a časová osa **nejsou převzatý produkční renderer**. CSV načítá pouze jména do paměti stránky, bez odeslání či perzistence.
- Nastavení se po explicitním kliknutí `Uložit (demo)` pro účely testování ukládá pouze do `localStorage` tohoto prohlížeče; neexistuje synchronizace operátorů, server, databáze ani automatická aktivace OBS. Nastavení jednotlivých editorů jsou samostatná.
- Na desktopu mají nastavení a náhled oddělený svislý scroll a přetahovatelný poměr; mobil zobrazuje náhled nad formulářem. Při neuložených změnách se aktivuje ochrana před opuštěním.


## Backend Foundation (vývoj)

Nový backend je nezávislý na GitHub Pages. Postup lokálního spuštění a omezení najdeš v [server/README.md](server/README.md). Backend se dosud nepoužívá v React UI, OBS ani na VPS.
