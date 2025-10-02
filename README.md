# 🌐 OpenMindMap — Proof of Concept

OpenMindMap est une première ébauche d’application de **mind mapping** collaborative. Ce proof of concept se concentre sur les briques essentielles pour manipuler visuellement une carte et structurer ses idées.

## ✨ Fonctionnalités incluses

- Visualisation automatique d’un mind map radial autour d’un sujet principal.
- Sélection d’un nœud pour le renommer instantanément.
- Ajout rapide de nouvelles idées liées au nœud sélectionné.
- Suppression d’une branche entière (sauf le sujet central).
- Statistiques en direct sur le nombre d’idées et de niveaux.

## 🏗️ Stack

- [React](https://react.dev) + [Vite](https://vite.dev)
- Styles en CSS natif avec la police [Inter](https://rsms.me/inter/)

## 🚀 Démarrage

```bash
npm install
npm run dev
```

Puis ouvrez [http://localhost:5173](http://localhost:5173) pour découvrir l’interface.

## 🔭 Étapes suivantes possibles

- Navigation avancée (pan/zoom) et multi-sélection.
- Collaboration temps réel (CRDT) et présence multi-utilisateurs.
- Gestion avancée du contenu des nœuds (tags, dates, pièces jointes).
- Export/import vers des formats standard (Markdown, OPML, JSON).

Ce dépôt servira de base pour itérer vers une version complète d’OpenMindMap.
