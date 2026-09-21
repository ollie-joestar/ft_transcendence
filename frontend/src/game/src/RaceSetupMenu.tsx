import { Button } from "../../components/ui/Button.tsx";
import { Card, CardHeader } from "../../components/ui/Card.tsx";
import { LapSelector } from "./LapSelector.tsx";
import { TRACKS, type BotDifficulty } from "./options.ts";
import { useDarkMode } from "../../contexts/DarkMode.ts";
import { useTranslation } from "../../hooks/useTranslation.ts";

// Race types the player picks before entering a lobby / starting a race.
//  - 'bot'        : solo race against an AI car (difficulty + laps selectable)
//  - 'multiplayer': race other humans in a lobby (laps chosen in the lobby)
//  - 'timetrial'  : solo, infinite laps, chasing a personal-best lap
export type RaceType = "bot" | "multiplayer" | "timetrial";

interface RaceSetupMenuProps {
  raceType: RaceType;
  onRaceType: (t: RaceType) => void;
  botDifficulty: BotDifficulty;
  onBotDifficulty: (d: BotDifficulty) => void;
  laps: number;
  onLaps: (n: number) => void;
  trackId: string;
  onTrackId: (id: string) => void;
  onStart: () => void;
  onExit: () => void;
}

// A segmented row of mutually-exclusive choices, styled like the lobby buttons.
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      {options.map((o) => (
        <Button
          key={o.id}
          variant={o.id === value ? "primary" : "ghost"}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

export function RaceSetupMenu({
  raceType,
  onRaceType,
  botDifficulty,
  onBotDifficulty,
  laps,
  onLaps,
  trackId,
  onTrackId,
  onStart,
  onExit,
}: RaceSetupMenuProps) {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const t = useTranslation("game");

  // Colour scheme is bound to the site's light/dark mode (App syncs the game's
  // theme.ts to it), so the menu toggle just flips the shared dark-mode flag —
  // keeping the 3D world, minimap, and DOM panels cohesive with the frontend.
  const SCHEME_OPTIONS: { id: "light" | "dark"; label: string }[] = [
    { id: "light", label: t("light") },
    { id: "dark", label: t("dark") },
  ];

  const RACE_TYPES: { id: RaceType; label: string; desc: string }[] = [
    { id: "bot", label: t("botRace"), desc: t("botRaceDesc") },
    { id: "multiplayer", label: t("multiplayer"), desc: t("multiplayerDesc") },
    { id: "timetrial", label: t("timeTrial"), desc: t("timeTrialDesc") },
  ];

  // Time trial runs infinite laps, so it skips the bot + lap controls.
  const startLabel =
    raceType === "multiplayer" ? t("createLobby") : t("startRace");

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 12,
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-body)",
        color: "var(--text)",
        overflowY: "auto",
        padding: "32px 0",
      }}
    >
      {/* Title */}
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "3.5rem",
          letterSpacing: "0.15em",
          color: "var(--accent)",
          margin: 0,
          marginBottom: "4px",
        }}
      >
        SAKURA DRIFT
      </h1>
      <p
        style={{
          fontFamily: "var(--font-condensed)",
          fontSize: "11px",
          letterSpacing: "0.3em",
          color: "var(--muted)",
          textTransform: "uppercase",
          margin: "0 0 32px",
        }}
      >
        {t("raceSetup")}
      </p>

      <div
        style={{
          width: "100%",
          maxWidth: "560px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* Race type */}
        <Card>
          <CardHeader title={t("raceType")} />
          <div
            style={{
              padding: "12px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <Segmented
              options={RACE_TYPES}
              value={raceType}
              onChange={onRaceType}
            />
            <p
              style={{
                fontFamily: "var(--font-condensed)",
                fontSize: "11px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--muted)",
                margin: 0,
              }}
            >
              {RACE_TYPES.find((r) => r.id === raceType)?.desc}
            </p>
          </div>
        </Card>

        {/* Bot difficulty + laps — only for a bot race */}
        {raceType === "bot" && (
          <Card>
            <CardHeader title={t("botRace")} />
            <div
              style={{
                padding: "12px 20px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-condensed)",
                    fontSize: "11px",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                  }}
                >
                  {t("difficulty")}
                </span>
                <Segmented
                  options={[
                    { id: "easy", label: t("easy") },
                    { id: "hard", label: t("hard") },
                  ]}
                  value={botDifficulty}
                  onChange={onBotDifficulty}
                />
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-condensed)",
                    fontSize: "10px",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                  }}
                >
                  {t("laps")}
                </span>
                <LapSelector value={laps} onChange={onLaps} />
              </div>
            </div>
          </Card>
        )}

        {/* Track picker */}
        <Card>
          <CardHeader title={t("track")} />
          <div style={{ padding: "12px 20px" }}>
            <select
              value={trackId}
              onChange={(e) => onTrackId(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--surface)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              {TRACKS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* Colour scheme */}
        <Card>
          <CardHeader title={t("colorScheme")} />
          <div style={{ padding: "12px 20px" }}>
            <Segmented
              options={SCHEME_OPTIONS}
              value={isDarkMode ? "dark" : "light"}
              onChange={(id) => {
                if ((id === "dark") !== isDarkMode) toggleDarkMode();
              }}
            />
          </div>
        </Card>

        {/* Navigation: exit the room (→ dashboard) on the left, start on the right */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Button variant="ghost" onClick={onExit}>
            {t("backDashboard")}
          </Button>
          <Button variant="primary" onClick={onStart}>
            {startLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
