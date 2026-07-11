[plumbmonkey-site-README.md](https://github.com/user-attachments/files/29931796/plumbmonkey-site-README.md)
# plumbmonkey-site
Static website for Plumbmonkey Studio Services—Tailwind-powered landing, portfolio, and contact form.

The “Hire Me” form sends submissions to [Formspree](https://formspree.io/f/xjkrragg).
# Plumbmonkey Media — Studio Website

**Official website for Plumbmonkey Media / Plumbmonkey Studios**  
Original worlds in music, 3D animation, games & storytelling — plus selective high-end video editing, animated music videos, and scoring.

Live site (when deployed): [plumbmonkey.online](https://plumbmonkey.online)

---

## 🎯 Purpose

This repository powers the public face of the studio:

- Showcase original IP (**Ghost Circuit** animated band universe, music, comics, games)
- Portfolio of client work (video editing, animated music videos, hybrid AI/3D)
- Clear "Work With Me / Hire the Studio" path
- Asset store links (Gumroad)
- Patreon / Join the Studio
- Contact & booking

It is currently the **interim production site** while the full immersive Ghost Circuit haunted manor experience is built in Blender.

---

## 🛠️ Tech Stack

- **Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS
- **Language**: TypeScript + HTML
- **Forms**: Formspree
- **Deployment**: Ready for Vercel / Netlify / GitHub Pages
- **Other**: Static assets, portfolio data

---

## 📁 Project Structure

```
plumbmonkey-site/
├── app/                  # Next.js App Router pages
├── public/               # Static assets (images, favicons, etc.)
├── styles/               # Global CSS + Tailwind
├── data/                 # Portfolio / project data
├── lib/                  # Utilities (form handling, etc.)
├── components/           # Reusable UI (to be expanded)
├── index.html            # Current static landing (legacy / hybrid)
├── contact.html          # Contact / Hire Me
├── pricing.html          # Service packages
└── ...                   # Additional static pages
```

---

## 🚀 Getting Started (Local Development)

```bash
# Clone the repo
git clone https://github.com/PlumbMonkey/plumbmonkey-site.git
cd plumbmonkey-site

# Install dependencies
npm install

# Run development server
npm run dev
# → http://localhost:3000
```

For pure static preview (no Node required):
```bash
npx serve .
# or use VS Code Live Server extension
```

---

## ✨ Current Features

- Clean landing page focused on Ghost Circuit + services
- Portfolio section
- Contact / Hire Me form (Formspree)
- Pricing / packages pages
- Mobile-responsive Tailwind design
- SEO basics (robots.txt, sitemap)

---

## 🗺️ Roadmap

- [x] Basic Next.js + Tailwind setup
- [x] Contact form
- [ ] Full Ghost Circuit / manor branding refresh (in progress)
- [ ] Immersive manor-style navigation
- [ ] Dynamic portfolio from JSON/MD
- [ ] Integrated Gumroad store embeds
- [ ] Collab Charter page
- [ ] Blog / In Session updates section

---

## 🤝 Contributing / Collaboration

This is the public website for Plumbmonkey Media.  
Limited project collaborations and team interest are welcome — see the Collab Charter on the live site (coming soon).

For studio services or joint projects:  
📧 Contact via the form on [plumbmonkey.online](https://plumbmonkey.online)

---

## 📄 License

MIT License — see [LICENSE](LICENSE)

---

**Built with ❤️ by William "Plumbmonkey" Henwood**  
Alberta, Canada · [YouTube](https://www.youtube.com/@PlumbmonkeyMedia) · [Patreon](https://www.patreon.com/c/Plumbmonkey)
