# PR #32 – React authentication integration

## Výchozí režim: GitHub Pages je pořád pouze ukázka
`src/App.tsx` zachovává beze změn reálné součásti vizuálního prototypu a lokální mock data. Výchozí `npm run build` i stávající GitHub Pages používají demo režim **bez API přihlášení**.

## Přihlášená varianta
Pokud build dostane `VITE_LIVEPANEL_AUTH=enabled`, zobrazí se `AuthGate` a aplikace se vykreslí pouze po ověření `GET /api/auth/me`. Nedostupný backend vyvolá chybovou obrazovku, nikoli automatické zpřístupnění režie. Přihlašování je `POST /api/auth/login`, odhlášení `POST /api/auth/logout`, přehled a odhlášení zařízení `GET /api/auth/sessions` a `POST /api/auth/sessions/:id/revoke`, změna hesla `POST /api/auth/password`.

Klient používá pouze **stejný origin** a `credentials: 'same-origin'`. Nečte zabezpečené HttpOnly cookies, neskladuje tokeny ani hesla v localStorage/sessionStorage. Při návratu do okna znovu ověří relaci a reaguje na expiraci serverové relace.

DŮLEŽITÉ: Toto PR implementuje **přihlášení a správu vlastních sessions**, ale dosavadní React režie za přihlašovací branou stále používá **MOCK data** a její tlačítka dosud neodesílají skutečné COMMAND. Nezaměňovat autentizovaný frontend za skutečnou produkční režii. Pro produkční doménu bude třeba společná HTTPS topologie, správné směrování statických souborů a /api/, WSS, bezpečnostní audit a integrační testy, které tato etapa nepokrývá. Na VPS se nic nenasazuje.

Není povolené přihlašování z GitHub Pages na vzdálený produkční server přes CORS. Takové propojení by narušilo rozhodnutí o same-origin cookie autentizaci.
