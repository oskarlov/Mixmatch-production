import multiavatar from "@multiavatar/multiavatar/esm";

export default function Avatar({ seed, size = 56, title, style, className="" }) {
    const svg = multiavatar(seed);
    const src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    return (
        <img src={src} draggable={false} alt={title || seed} width={size} height={size} style={style} className={`rounded-full ring-2 ring-white/20 shadow ${className}`} />
    );

}