import { AuroraPoster } from "./aurora";
import { BoldTypePoster } from "./bold-type";
import { EditorialPoster } from "./editorial";
import { SpotlightPoster } from "./spotlight";
import {
  DEFAULT_POSTER_TEMPLATE,
  type PosterComponent,
  type PosterTemplateId,
} from "./types";

export type PosterTemplateMeta = {
  id: PosterTemplateId;
  label: string;
  description: string;
  component: PosterComponent;
};

/** Templates available to render/pick. Spotlight (photo) ships in Phase 2. */
export const POSTER_TEMPLATES: Partial<Record<PosterTemplateId, PosterTemplateMeta>> = {
  aurora: {
    id: "aurora",
    label: "Aurora",
    description: "Gradient with soft blobs",
    component: AuroraPoster,
  },
  boldType: {
    id: "boldType",
    label: "Bold Type",
    description: "Oversized title, high impact",
    component: BoldTypePoster,
  },
  editorial: {
    id: "editorial",
    label: "Editorial",
    description: "Clean light layout",
    component: EditorialPoster,
  },
  spotlight: {
    id: "spotlight",
    label: "Spotlight",
    description: "Speaker photo hero",
    component: SpotlightPoster,
  },
};

/** Ordered list for the picker (only built templates). */
export const POSTER_TEMPLATE_LIST: PosterTemplateMeta[] = [
  POSTER_TEMPLATES.aurora!,
  POSTER_TEMPLATES.boldType!,
  POSTER_TEMPLATES.editorial!,
  POSTER_TEMPLATES.spotlight!,
];

/** Resolves a template id to its component, falling back to the default. */
export function resolvePosterComponent(id: PosterTemplateId): PosterComponent {
  return (POSTER_TEMPLATES[id] ?? POSTER_TEMPLATES[DEFAULT_POSTER_TEMPLATE]!).component;
}
