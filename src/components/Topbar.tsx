"use client";

import { Icon, type IconName } from "./icons";
import { WindowControls } from "./WindowControls";
import { ProfileMenu } from "./ProfileMenu";
import { TimerButton } from "./TimerButton";
import { NotificationsButton } from "./NotificationsButton";
import { useChronoStore } from "@/store/useChronoStore";
import { useUI } from "@/store/useUI";
import { focusSmartInput } from "@/lib/ui";

export function Topbar({ onOpenFriends }: { onOpenFriends: () => void }) {
  const query = useChronoStore((s) => s.query);
  const setQuery = useChronoStore((s) => s.setQuery);
  const setView = useChronoStore((s) => s.setView);
  const toggleSidebar = useUI((s) => s.toggleSidebar);

  return (
    <div className="drag-region flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] px-4">
      <IconButton name="collapse" label="Скрыть/показать панель" onClick={toggleSidebar} />
      <IconButton name="plus" label="Новая задача" onClick={focusSmartInput} />

      <div className="no-drag mx-auto flex w-full max-w-md items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-2 transition-colors focus-within:border-violet-400/40">
        <Icon name="search" size={15} className="text-white/35" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск"
          className="w-full bg-transparent text-[13px] text-white/85 outline-none"
          aria-label="Поиск задач"
        />
      </div>

      <div className="no-drag flex items-center gap-1">
        <IconButton name="calendar" label="Календарь" onClick={() => setView("calendar")} />
        <TimerButton />
        <NotificationsButton />
      </div>

      <div className="no-drag ml-1 border-l border-white/[0.06] pl-2">
        <ProfileMenu onOpenFriends={onOpenFriends} />
      </div>

      <div className="no-drag border-l border-white/[0.06] pl-2">
        <WindowControls />
      </div>
    </div>
  );
}

function IconButton({
  name,
  label,
  onClick,
}: {
  name: IconName;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="no-drag relative grid h-9 w-9 place-items-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.06] hover:text-violet-200"
    >
      <Icon name={name} size={17} />
    </button>
  );
}
