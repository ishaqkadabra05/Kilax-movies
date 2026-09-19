# Kilax Password Reset & Authentication Validation

This build includes:

- `/forgot-password` password-reset request page.
- `/reset-password` secure password-change page.
- Forgot-password links in the main sign-in/auth UI.
- Supabase recovery-session handling for PKCE/code, token-hash, and legacy hash recovery links.
- Password validation: minimum 6 characters.
- Email validation with the example placeholder `samplemail@gmail.com`.
- International phone-country selector with a required calling code.
- Phone validation using E.164 constraints: country calling code is mandatory and the complete number is limited to the international E.164 maximum of 15 digits.
- Phone numbers are normalized and saved to Supabase Auth user metadata in `+countrycode...` format during email signup.
- Phone sign-in in the redesigned home auth modal uses the normalized international number.

## Supabase configuration

In Supabase Dashboard → Authentication → URL Configuration:

### Production

Set the Site URL to your real Kilax domain, for example:

`https://your-kilax-domain.com`

Add this redirect URL:

`https://your-kilax-domain.com/reset-password`

### Local development

Add:

`http://localhost:4577/reset-password`

The application uses the current browser origin when it requests the recovery email, so the URL that is actually used must be present in Supabase's allowed redirect URLs.

## Email delivery

Supabase Auth must be able to send the recovery email. For production, configure a custom SMTP provider in Supabase Auth rather than relying on the default trial email service.

## Important

The frontend never receives or stores an administrator/service-role key. Password changes are performed through Supabase Auth after the user arrives with a valid recovery session.
