# Telemetry

Production builds send anonymous usage counts to PostHog (one project shared with the other inlang apps), through the reverse proxy at `https://inlang.com/relay` so the plugin only allowlists `inlang.com`. Dev builds send nothing. Events follow PostHog's `category:object_action` naming and carry `app: "parrot"`, `app_version` and a hashed `project_id`:

- `app:session_start` - the plugin opened
- `project:project_view` - `message_count`, `language_count`, `collaborator_count`, `linked_layer_count`, `frame_count`
- `translation:language_update` - `frame_count`
- `messages:link_create` - `source`, `layer_count`, `new_message_count`
- `import:file_submit` / `export:file_create` - `format`, `message_count`
- `cloud:interest_button_click` - `topic` (`cloud`, `machine_translation`)

The user id is the hashed Figma user id. No message texts, keys or file names are sent. See `src/lib/telemetry/Telemetry.ts`.
