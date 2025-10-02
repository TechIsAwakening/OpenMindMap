# 🌐 OpenMindMap  
Application web de **mind mapping** moderne, collaborative et extensible.  

## 🚀 Objectifs
OpenMindMap permet de créer, organiser et partager des cartes mentales de manière fluide et intuitive.  
L’accent est mis sur :  
- 🖱️ **Édition fluide** (pan/zoom, drag & drop, annuler/rétablir illimités).  
- 🤝 **Collaboration en temps réel** avec suivi des modifications.  
- 🎨 **Personnalisation visuelle** (thèmes clair/sombre, styles de nœuds, icônes, couleurs).  
- 🔄 **Interopérabilité** (import/export vers Markdown, OPML, JSON, PNG, SVG, PDF).  
- 🛡️ **Sécurité & versioning** (snapshots, rollback, historique des versions).  

---

## ✨ Fonctionnalités prévues

### 1. Canvas & édition
- Pan/zoom fluide, minimap, grille + snapping.  
- Sélection multiple, copier/coller/dupliquer, annuler/rétablir illimités.  
- Alignement & distribution (smart guides), calques, containers.  
- Mode focus/zen, multi-onglets/multi-cartes.  
- Command palette & raccourcis personnalisables.  

### 2. Nœuds & contenus
- Rich-text (titres, listes, liens, emojis).  
- Tags, priorités, dates, assignations.  
- Images, fichiers, audio/vidéo embarqués.  
- Templates de nœuds réutilisables.  

### 3. Collaboration
- Multi-curseurs, présence en direct.  
- Commentaires, @mentions, réactions.  
- Historique des changements & diff visuel.  

### 4. Import / Export
- Formats : Markdown, OPML, JSON, FreeMind/XMind.  
- Export : PNG, SVG, PDF, PPT (présentation).  

### 5. IA assistive (optionnel)
- Génération de branches à partir de texte ou URL.  
- Résumés automatiques.  
- Suggestion de tags et clustering sémantique.  

---

## 🛠️ Stack technique (proposée)
- **Frontend** : React + Vite + TailwindCSS + React Flow.  
- **Collaboration temps réel** : Y.js / CRDT.  
- **Backend** : Node.js (Express ou NestJS).  
- **Base de données** : PostgreSQL + Prisma.  
- **Stockage fichiers** : S3 compatible (MinIO / AWS).  
- **Authentification** : OAuth2 / SSO.  

---

## 📦 Installation (MVP local)

```bash
# Cloner le repo
git clone https://github.com/TechIsAwakening/OpenMindMap.git
cd OpenMindMap

# Installer les dépendances
npm install

# Lancer en mode dev
npm run dev
```

## 🧾 Exporter la carte en PDF

- Ouvrez l'application et assurez-vous que la carte mentale est visible dans le canvas.
- Cliquez sur le bouton **« Exporter en PDF »** présent dans la barre supérieure.
- Un indicateur de chargement s'affiche durant la génération ; en cas de succès, le fichier PDF est automatiquement téléchargé.
- En cas d'erreur (par exemple contenu externe bloqué), un message d'avertissement détaille la marche à suivre.

L'export repose sur `dom-to-image-more` pour convertir le `<svg class="mindmap-canvas">` en image raster puis sur `jspdf` pour composer et enregistrer le document PDF.

