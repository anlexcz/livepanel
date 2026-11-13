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

## Dokumentace

- [Hlavní koncepce](https://docs.google.com/document/d/1SYBHHQ58sdE3D_rJCb9AjMw0TO9JvJ9G5qU-WEvxd4I/edit)
- [UI/UX Design](https://docs.google.com/document/d/1erayGTEZqUEs3jQl-8oCz5OItgiqMVyHbkveZpKLQuQ/edit)
- [Technická architektura](https://docs.google.com/document/d/1I-1_TYF-PH_NHz2NtYZNxhDiBdRsXpBZyOpSMGKi1J8/edit)
