# Fast

Application iPhone de mesure en voiture : vitesse, forces G et trajet.
Bêta personnelle — tout reste sur le téléphone (pas de compte, pas de serveur).

## Stack

Expo SDK 58 · React Native · TypeScript · expo-router · Reanimated · expo-sqlite

## Lancer en développement

```bash
npm install
npx expo start
```

Ouvrir le QR code avec Expo Go sur l'iPhone (même compte Expo dans le terminal et dans l'app).

## Vérifications

```bash
npm run typecheck
npm run lint
npm test
```

## Build iOS

`.ipa` non signé via GitHub Actions : onglet **Actions** › **iOS — .ipa non signé** › **Run workflow**,
puis installation avec un outil de sideload.

---

© Tous droits réservés.
