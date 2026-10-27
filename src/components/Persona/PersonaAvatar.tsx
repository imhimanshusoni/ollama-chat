import { Mascot } from '../Mascot/Mascot';
import type { MascotMood } from '../Mascot/mood';

// Renders a persona avatar: the app mascot when avatar is 'mascot', an image
// when it's a data URI / URL, otherwise an emoji/text. The `className` supplies
// size + shape (border-radius); images are cover-fit and clipped to it.
interface Props {
  avatar: string;
  className?: string;
  mood?: MascotMood; // mascot only
  still?: boolean; // mascot only
}

export function PersonaAvatar({ avatar, className, mood = 'idle', still }: Props) {
  if (avatar === 'mascot') {
    return (
      <span className={className} aria-hidden="true" style={{ background: 'none', boxShadow: 'none' }}>
        <Mascot mood={mood} size="100%" still={still} />
      </span>
    );
  }
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
