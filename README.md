# Tour de Skiftet — fillarireissun reittiopas

**▶ Live: https://wnt.github.io/tour-de-skiftet/**


Interaktiivinen, mobiilikäyttöön ja offline-tilaan suunniteltu reittiopas saariston
rengastien pohjoiselle lenkille **Kustavi → Brändö → Houtskär → Iniö → Kustavi**
(suunta ja päivät valittavissa Vaihtoehdot-välilehdeltä). Yhdellä sivulla:

- 🗺️ **Kartta** — koko reitti, etäisyydet jokaisella välillä, lautta- ja pyöräosuudet,
  majoitukset ja "paikanna minut".
- ⚖️ **Vaihtoehdot** (aloitusnäkymä) — kaikki 2 päivän lenkkivaihtoehdot molempiin suuntiin, järjestettynä tuoreen FMI-sään mukaan. Valitse yksi → muut näkymät päivittyvät sen mukaan.
- 🚲 **Reitti** — valitun vaihtoehdon **päiväohjelma ensin**, sitten vaiheittainen etappilista; **sähköpyörän ajoajat** (20 km/h) ja jokaisella lauttavälillä **kaikki päivän vuorot** (viimeisin ehtivä korostettuna) + linkki aikatauluun.
- ⛴️ **Lautat** — lauttojen aikataulut, seuraava lähtö, varaustiedot ja linkit; valitun päivän yhteydet korostettuna.
- 🌤️ **Sää** — sääennuste **Ilmatieteen laitoksen** avoimesta datasta (FMI WFS) jokaiseen pisteeseen, tuuli korostettuna; valitut matkapäivät korostettuna.
- 🌧️ **Sadetutka** — Kartta-välilehden 🌧️-painike näyttää FMI:n tutka-animaation (edellinen tunti) reitin päällä.
- ℹ️ **Info** — majoitukset, hyvä-tietää-vinkit ja lähteet.

## Käyttäjätarinat (toteutetut)

1. **Tiivis päiväohjelma.** Käyttäjänä haluan päiväohjelman askelten olevan tiiviitä (`🚲 Osnäs → Kivimaa · 9,5 km · ~29 min`) ilman sulkeissa olevaa täytettä, jotta luen ne yhdellä silmäyksellä.
2. **Kaikki lauttavuorot + viimeisin ehtivä.** Käyttäjänä haluan nähdä jokaisen yhteysaluksen kaikki päivän lähdöt, joista viimeisin matkavauhtiin sopiva on korostettu, jotta tiedän pelivarani.
3. **Vahvista käytetty vuoro reaaliajassa.** Reissun aikana haluan napauttaa "otin tämän vuoron" ja että loppusuunnitelma laskee uudelleen ja näyttää vain relevantit jatkoyhteydet.
4. **Linkki aikatauluun.** Haluan jokaisesta yhteysaluksesta "Aikataulu →" -linkin, joka vie suoraan k.o. päivän k.o. aluksen aikatauluun sovelluksen sisällä.
5. **Vaihtoehtojen vertailu.** Haluan valita matkapäivät säävertailun perusteella, jolloin Reitti, Sää ja Lautat heijastavat valintaa.

Sovellus on **PWA**: sen voi asentaa puhelimen kotinäytölle ja se toimii **offline-tilassa**
(reitti, etäisyydet ja aikataulut aina; kartta niiltä alueilta jotka on kerran ladattu
verkossa; viimeksi haettu sääennuste).

## Käyttö paikallisesti

Mikä tahansa staattinen palvelin käy. Esim.:

```bash
node server.js          # → http://localhost:8138
# tai
python3 -m http.server 8138
```

> Service worker ja sijainti vaativat `http(s)`-yhteyden — `file://` ei riitä.

## Julkaisu GitHub Pagesiin

1. Luo repo ja työnnä tämän kansion sisältö sen juureen:

   ```bash
   git init
   git add .
   git commit -m "Tour de Skiftet trip planner"
   git branch -M main
   git remote add origin git@github.com:<käyttäjä>/<repo>.git
   git push -u origin main
   ```

2. GitHubissa: **Settings → Pages → Build and deployment → Source: _Deploy from a branch_**,
   valitse **branch: `main`** ja **folder: `/ (root)`**, tallenna.

3. Muutaman minuutin kuluttua sovellus on osoitteessa
   `https://<käyttäjä>.github.io/<repo>/`.

Kaikki polut ovat suhteellisia, joten sovellus toimii alikansiossa
(`/<repo>/`) sellaisenaan. Ei käännösvaihetta, ei riippuvuuksia asennettavaksi —
Leaflet on mukana paketissa (`vendor/`).

> Vinkki: avaa sovellus kerran verkkoyhteydessä ja selaa karttaa hiukan, niin
> karttaruudut tallentuvat offline-käyttöä varten. Lisää sitten kotinäytölle
> (Jaa → Lisää Koti-valikkoon).

## Tietojen muokkaus

Kaikki matkakohtainen tieto on tiedostossa [`data.js`](data.js):

- `places` — paikat ja koordinaatit
- `legs` — etapit järjestyksessä (pyörä/lautta + etäisyys)
- `ferries` — lauttojen aikataulut (`dow` = viikonpäivät 0=su … 6=la)
- `accommodations`, `dayPlan`, `weatherSpots`, `infoNotes`, `sources`, `dataGaps`
- `meta.tripStart` / `meta.tripEnd` — matkapäivät, jotka korostetaan sääennusteessa
- `meta.ebikeKmh` — pyörän keskinopeus, jolla ajoajat lasketaan (oletus 20 km/h)

Kun muokkaat tiedostoja, **nosta välimuistin versiota** [`sw.js`](sw.js):n alussa
(`const VERSION = 'skiftet-v3'`), jotta käyttäjät saavat päivitykset.

## ⚠️ Aikataulut — tarkista aina

Lauttojen ajat on kerätty kesäkuussa 2026 operaattoreiden virallisista lähteistä
(Ålandstrafiken, Finferries, brando.ax) ja ne koskevat **kesää 2026**. Ne ovat
suunnittelun apu — **aikataulut voivat muuttua, ja osa lautoista vaatii
ennakkovarauksen**:

- **Ådan** (Osnäs→Åva): varaus pakollinen — `alandstrafiken.ax`
- **Skiftet / Houtskärin reitti** (Torsholma→Roslax): varaus pakollinen viimeistään
  edellisenä päivänä klo 17 — `booking.finferries.fi`. **Ei kulje ma eikä la.**
- **Replot** (Mossala→Dalen): varaus suositeltu — `booking.finferries.fi`
- **Sterna** (Kannvik→Heponiemi): maksuton, ei varausta

Vahvista ajat ja tee varaukset ennen lähtöä. Lähteet löytyvät sovelluksen Info-välilehdeltä.

## Lähteet

- brando.ax — saaristolauttojen info ja Tour de Skiftet -reitti
- Ålandstrafiken & Finferries — viralliset aikataulu-PDF:t (2026)
- Karttapohja © OpenStreetMap-tekijät
- Sääennuste & sadetutka: [Ilmatieteen laitos, avoin data](https://www.ilmatieteenlaitos.fi/avoin-data) — FMI WFS-ennuste (`opendata.fmi.fi`) ja tutka-WMS (`openwms.fmi.fi`), ei API-avainta. Molemmat sallivat selainkutsut (CORS), joten erillistä palvelinta ei tarvita.
