// Renders a persona avatar as an image when it's a data URI / URL, otherwise as
// an emoji/text. The `className` supplies size + shape (border-radius); images
// are cover-fit and clipped to it.
interface Props {
  avatar: string;
  className?: string;
}

export function PersonaAvatar({ avatar, className }: Props) {
  const isImage = /^(data:|https?:)/.test(avatar);
  if (isImage) {
    return (
      <img
        src={avatar}
        alt=""
        className={className}
        style={{ objectFit: 'cover', display: 'block' }}
      />
    );
  }
  return (
    <span className={className} aria-hidden="true">
      {avatar}
    </span>
  );
}
