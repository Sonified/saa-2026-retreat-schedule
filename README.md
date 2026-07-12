# Simply Always Awake 2026 Retreat Schedule

A minimal personal live retreat clock and local-time schedule for the Simply Always Awake 2026 Online Retreat.

The published schedule is in Pacific time. The app converts it to each visitor's local time zone and shows:

- the current schedule item
- a large countdown to the next item
- day tabs that automatically open the current retreat day
- every Pacific-time retreat schedule, converted to the visitor's local date and time
- links to session recordings as they become available

## Edit the Schedule

The schedule lives in `app.js`:

- `SOURCE_TIME_ZONE` sets the original schedule time zone.
- `RETREAT_DATES` sets the retreat dates.
- `FULL_DAY` and `SUNDAY` set the session starts and labels.
- `POST_RETREAT_HOME_ROUTE` selects the first-page experience after the final `Close`. Set it to `"retreat-live"` to retain the original retreat status view.
- `RECORDINGS` maps a retreat date and session name to its YouTube URL. Add new links there as recordings become available.
- Change `version.json` for each live deployment. Open pages check this marker every 60 seconds, then reload the versioned page and script only when it changes.

## GitHub Pages

Publish from the `main` branch root.
