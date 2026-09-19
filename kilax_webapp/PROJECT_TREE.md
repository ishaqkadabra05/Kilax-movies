# Kilax Movies Project Tree

This is a structure note only. The folders below are planned as future sections for the project and are not created as actual subfolders inside the website directory.

```text
kilax_webapp/
├── app/                             # Website pages and app routes
│   ├── api/                         # Payment, auth, streaming, search APIs
│   ├── auth/                        # Login, reset, callback pages
│   ├── movies/
│   ├── series/
│   ├── player/
│   ├── profile/
│   ├── search/
│   ├── subscribe/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/                     # Shared UI components
├── hooks/                          # React hooks
├── lib/                            # Auth, payments, Supabase, utils
├── public/                         # Static assets and PWA files
├── scripts/                        # Setup/build scripts
├── supabase/                       # DB schema and configs
├── package.json
├── next.config.ts
├── tsconfig.json
├── README.md
├── .gitignore
├── admin-panel/                    # Planned admin panel section
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── README.md
├── mobile-app/                     # Planned mobile app section
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── README.md
├── docs/                           # Shared documentation area
│   ├── architecture/
│   ├── deployment/
│   └── README.md
├── PROJECT_TREE.md                 # This tree note
└── ...
```

## Notes

- The website remains the active project inside `kilax_webapp`.
- `admin-panel`, `mobile-app`, and `docs` are planned structure placeholders only.
- They are not physically created inside this folder as separate directories in the repository.
