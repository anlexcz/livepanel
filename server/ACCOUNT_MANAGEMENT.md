# Account Management – bezpečnostní hranice

## Ovládání účtů
Správa účtů je prozatím vyhrazena správci s lokálním přístupem k serveru; nemíchá se s běžnými právy režijních operátorů. Provozní administrace účtů přes HTTP/WS zatím **není** dostupná.

Příkazy z kořene repozitáře po `npm ci --prefix server` a `npm run backend:build`:

```sh
# Vypisuje pouze ID, jméno, aktivitu a označení sdíleného účtu:
npm --prefix server run auth:manage -- list

# Založení účtu, heslo výhradně na stdin:
printf '%s' "$PASSWORD" | npm --prefix server run auth:manage -- create operator1

# Reset hesla: vyžaduje číslo uživatele a revokuje všechna jeho přihlášení:
printf '%s' "$NEW_PASSWORD" | npm --prefix server run auth:manage -- reset-password 1

# Deaktivace účtu ihned zneplatní jeho relace:
npm --prefix server run auth:manage -- deactivate 1

# Znovuaktivace účtu (neobnovuje staré relace):
npm --prefix server run auth:manage -- activate 1
```

Pozor: nepředávej skutečná hesla jako argumenty, neukládej je do historie shellu ani do repozitáře. Uvedené proměnné představují pouze příklad, tajemství musí být zadáváno bezpečně. Konfigurace databáze je řízena `LIVEPANEL_DB_PATH`. Nedoporučuje se měnit účty během vysílání bez provozního postupu.

## Samoobslužná změna hesla
`POST /api/auth/password`: přihlášený operátor poskytne `currentPassword` a `newPassword`; změna vyžaduje přesný HTTPS `Origin`. Po úspěchu jsou atomicky zneplatněny všechny relace daného účtu a klient se musí znovu přihlásit. Chybné současné heslo nezmění stav.

## Bezpečnostní upozornění
Provozní limitace přihlašovacích pokusů v PR #30 je pouze v paměti procesu, a proto není odolná vůči distribuovanému útoku ani restartu. Nenahrazuje ochrany reverzní proxy. Veřejné zpřístupnění vyžaduje TLS, správné předávání IP adres, audit CSRF, limity, bezpečnostní hlavičky, monitoring a pečlivou revizi identity a oprávnění.

Neexistuje veřejná registrace ani obecné režijní role. Stejná režijní práva všech operátorů zůstávají zachována; citlivá administrace účtů je samostatná provozní pravomoc správce serveru.
