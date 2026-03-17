# Controle One — Frontend

## 1. Présentation du projet
Controle One est une plateforme web qui facilite la prise de rendez-vous pour le contrôle technique automobile en France. Le projet répond à un besoin concret lié à une obligation légale pour les automobilistes : réaliser leur contrôle technique dans les délais réglementaires.

Ce dépôt contient uniquement la partie frontend (HTML, CSS, JavaScript vanilla), sans logique backend.

## 2. Problématique
- La prise de rendez-vous est souvent dispersée entre de nombreux sites de centres.
- Les créneaux disponibles sont difficiles à comparer rapidement.
- L'absence de centralisation complique l'expérience utilisateur.

## 3. Solution
Controle One propose une interface centralisée permettant de :
- rechercher un centre de contrôle technique ;
- consulter les disponibilités ;
- réserver un créneau simplement ;
- suivre ses réservations depuis un espace dédié.

## 4. Fonctionnalités principales
- Recherche de centres de contrôle technique.
- Consultation des créneaux disponibles.
- Réservation d'un rendez-vous.
- Gestion du compte utilisateur.
- Espace de gestion pour les centres.

## 5. Structure du projet
Arborescence frontend actuelle :

```text
controle-one-frontend-/
├── README.md
├── .gitignore
├── index.html
├── pages/
│   ├── search.html
│   ├── login.html
│   ├── register.html
│   ├── booking.html
│   ├── user-dashboard.html
│   └── garage-dashboard.html
├── styles/
│   ├── main.css
│   ├── base/
│   │   ├── reset.css
│   │   ├── variables.css
│   │   └── typography.css
│   ├── layout/
│   │   ├── header.css
│   │   ├── footer.css
│   │   └── grid.css
│   ├── components/
│   │   ├── buttons.css
│   │   ├── forms.css
│   │   └── cards.css
│   └── pages/
│       ├── home.css
│       ├── search.css
│       ├── auth.css
│       ├── booking.css
│       ├── dashboard-user.css
│       └── dashboard-garage.css
├── scripts/
│   ├── main.js
│   ├── api.js
│   └── utils.js
├── assets/
│   ├── images/
│   ├── icons/
│   └── logos/
└── docs/
    ├── wireframes/
    ├── ui-mockups/
    ├── design-system/
    └── frontend-notes/
```

Convention de nommage appliquée :
- Code, fichiers, dossiers, classes CSS et fonctions JavaScript en anglais.
- Documentation, README et explications en français.
- Cette séparation améliore la lisibilité internationale du code tout en conservant une documentation adaptée au contexte pédagogique francophone.

## 6. Organisation GitHub
Gestion de version recommandée :

- `main` : branche de production (stable).
- `develop` : branche d'intégration continue des fonctionnalités validées.
- `feature/*` : branches de développement par fonctionnalité (ex. `feature/search-centers`).

Règles de travail :
- Aucun commit direct sur `main`.
- Développement sur branches `feature/*`.
- Intégration via Pull Request vers `develop`, puis fusion contrôlée vers `main`.
- Relecture de code systématique avant merge.

## 7. État actuel du projet
Le projet est en phase de développement frontend :
- architecture de dossiers mise en place ;
- pages principales créées ;
- base CSS structurée ;
- scripts JavaScript prêts pour l'intégration backend future.
