import type { MeResponse, TelegramUser } from "../../types";

type Props = {
  user: TelegramUser | null;
  me: MeResponse | null;
  size?: "md" | "sm";
  className?: string;
};

function avatarLetter(user: TelegramUser | null, me: MeResponse | null) {
  const first = me?.user?.firstName ?? user?.first_name;
  const username = user?.username ?? me?.user?.username;
  const source = first?.charAt(0) ?? username?.charAt(0) ?? "P";
  return source.toUpperCase();
}

export function resolveUserPhotoUrl(user: TelegramUser | null, me: MeResponse | null) {
  return user?.photo_url?.trim() || null;
}

export function ProfileAvatar({ user, me, size = "md", className = "" }: Props) {
  const photoUrl = resolveUserPhotoUrl(user, me);
  const sizeClass = size === "sm" ? "settings-avatar settings-avatar--mobile" : "settings-avatar";

  if (photoUrl) {
    return <img src={photoUrl} alt="" className={`${sizeClass} settings-avatar-image ${className}`.trim()} />;
  }

  return <div className={`${sizeClass} ${className}`.trim()}>{avatarLetter(user, me)}</div>;
}
