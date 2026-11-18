import type { SVGProps } from "react";

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      {...props}
    />
  );
}

export const PlayIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M5 3.5v9l7-4.5z" fill="currentColor" stroke="none" />
  </Icon>
);
export const StopIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="4" y="4" width="8" height="8" rx="1.2" fill="currentColor" stroke="none" />
  </Icon>
);
export const ChevronDownIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4.5 6.5 8 10l3.5-3.5" />
  </Icon>
);
export const VolumeIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 6.2h2.2L8.5 3.5v9L5.2 9.8H3z" fill="currentColor" stroke="none" />
    <path d="M10.8 5.6a3.4 3.4 0 0 1 0 4.8M12.6 3.9a5.8 5.8 0 0 1 0 8.2" />
  </Icon>
);
export const MutedIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 6.2h2.2L8.5 3.5v9L5.2 9.8H3z" fill="currentColor" stroke="none" />
    <path d="M10.5 6l3 4M13.5 6l-3 4" />
  </Icon>
);
export const MicIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="6" y="2.5" width="4" height="7" rx="2" />
    <path d="M3.8 8a4.2 4.2 0 0 0 8.4 0M8 12.2v1.6" />
  </Icon>
);
export const MicOffIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M10 7.2V4.5a2 2 0 0 0-3.9-.6M6 6v1.5a2 2 0 0 0 3.2 1.6" />
    <path d="M3.8 8a4.2 4.2 0 0 0 7 3.1M12.2 8M8 12.2v1.6M2.5 2.5l11 11" />
  </Icon>
);
export const PhoneIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path
      d="M4.6 2.8l1.6.1.9 2.6-1.2 1a8 8 0 0 0 3.6 3.6l1-1.2 2.6.9.1 1.6c0 .7-.6 1.3-1.3 1.3A10.6 10.6 0 0 1 3.3 4.1c0-.7.6-1.3 1.3-1.3z"
      fill="currentColor"
      stroke="none"
    />
  </Icon>
);
export const SendIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
  </Icon>
);
export const UploadIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M8 11V3.5M4.8 6.5 8 3.3l3.2 3.2M3 12.8h10" />
  </Icon>
);
