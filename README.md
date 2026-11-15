# HODINY — evidence pracovní doby a lékařských služeb

Jednoduchá responzivní webová aplikace pro **GitHub Pages**, bez vlastního serveru.

## Co umí

- Zápis dne: **Příchod, Odchod, Dienst Come, Dienst GO**.
- Podpora služeb přes půlnoc a **služeb delších než 24 hodin**. U služby od 07:30 do 08:30 následujícího dne je nutné zaškrtnout „Odchod následující den“: výsledek bude **25:00**. Pokud je koncový čas dřívější než počáteční, následující den se rozpozná automaticky.
- Odděleně počítá běžnou pracovní dobu, službu a započtený čas (dovolená/nemoc apod.). Časové překryvy se v celkovém čase nepočítají dvakrát.
- Databáze s filtrováním podle měsíce, vyhledáváním, editací a mazáním.
- Denní, týdenní (ISO týdny), měsíční a roční přehled.
- Import JSON, export JSON (úplná záloha) a CSV (Excel).
- Základní offline podpora po prvním načtení přes HTTPS.

## Publikování na GitHub Pages (cca 5 kroků)

1. Na [github.com](https://github.com) založ nový repozitář, například **hodiny**. Můžeš jej nastavit jako **Public**, protože aplikace **neobsahuje tvoje osobní záznamy**.
2. Do kořene repozitáře nahraj **obsah této složky** (`index.html`, `app.js`, `core.mjs`, `styles.css`, `sw.js`, `manifest.webmanifest`, obrázky ikony). Nenahrávej jen ZIP — rozbal jej. Soubory `README.md` a `test.mjs` tam být mohou.
3. V repozitáři otevři **Settings → Pages**.
4. V části **Build and deployment → Source** zvol **Deploy from a branch**, potom `main` a `/ (root)`, a potvrď **Save**.
5. Aplikace bude dostupná na adrese typu `https://TVUJ-UCET.github.io/hodiny/`.

**Důležité:** Soubor `hodiny_private_import.json` **nesmíš nahrát do veřejného repozitáře**. Je to osobní databáze.

## Import původního Excelu

Z původního souboru `Hodiny.xlsx` byl připraven soukromý soubor `hodiny_private_import.json` s **193 zápisy** za březen až listopad.

1. Otevři nasazený web a záložku **Záloha a import**.
2. Zkontroluj **Rok původního Excelu**. Protože zdrojová tabulka neobsahovala rok, při převodu byl **předpokládán rok 2026**. Rok lze před importem změnit.
3. Vyber `hodiny_private_import.json` ze svého zařízení.
4. Aplikace data uloží **jen do aktuálního prohlížeče**. V přehledu a databázi se poté objeví importované zápisy.

Poznámka: 14. května je správně načtená **25hodinová služba** 07:30 → 08:30 následující den. Rovněž byly zachovány veškeré ručně započtené hodiny ve dnech bez vyplněného příchodu a odchodu.

## Soukromí a synchronizace

GitHub Pages je **statický hosting**, nikoliv databázový server. Záznamy se ukládají do `localStorage` ve tvém zařízení. Nejsou automaticky dostupné na jiném zařízení, po vymazání dat prohlížeče nebo v anonymním režimu se mohou ztratit.

**Doporučujeme** zálohovat pravidelně tlačítkem **Stáhnout JSON**. Zálohu pak můžeš importovat na jiném zařízení. Pro skutečnou synchronizaci mezi zařízeními lze do další verze doplnit soukromou databázi, autentizaci a např. Supabase (a správná pravidla přístupu).

Aplikace není určena k evidenci identifikovatelných údajů pacientů.

## Kontrola dat

`node test.mjs` ověřuje 25hodinovou službu, výpočty a původní měsíční součty pro všech 9 listů.

## Pro vývojáře

Jde o čistý HTML/CSS/JS bez knihoven, backendu a build procesu. Nepotřebuje API klíče ani externí databázi. Soubor `core.mjs` obsahuje čisté výpočetní funkce. Pro lokální zobrazení použij např. `python -m http.server 8000` v této složce a otevři `http://localhost:8000`.
