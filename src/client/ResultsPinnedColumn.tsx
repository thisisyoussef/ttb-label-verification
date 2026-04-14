import { InfoAnchor } from './InfoAnchor';
import type { BeverageSelection, LabelImage } from './types';

const BEVERAGE_LABELS: Record<BeverageSelection, string> = {
  auto: 'Auto-detect',
  'distilled-spirits': 'Distilled Spirits',
  'malt-beverage': 'Malt Beverage',
  wine: 'Wine',
  unknown: 'Unknown'
};

interface ResultsPinnedColumnProps {
  image: LabelImage;
  beverage: BeverageSelection;
}

export function ResultsPinnedColumn({ image, beverage }: ResultsPinnedColumnProps) {
  return (
    <aside className="md:col-span-4 lg:col-span-3 bg-surface-container-low p-6 lg:p-8 flex flex-col gap-6 border-r border-outline-variant/15">
      <h2 className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
        Intake context
      </h2>

      {image.file.type === 'application/pdf' ? (
        <div className="aspect-[3/4] bg-surface-container-highest rounded-lg flex items-center justify-center">
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-5xl text-on-surface-variant"
          >
            picture_as_pdf
          </span>
        </div>
      ) : (
        <img
          alt="Submitted label thumbnail"
          src={image.previewUrl}
          className="w-full aspect-[3/4] object-cover rounded-lg bg-surface-container-highest"
        />
      )}

      <dl className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <dt className="font-label text-[11px] uppercase tracking-wider text-on-surface-variant">
            Filename
          </dt>
          <dd className="font-mono text-sm font-semibold text-on-surface break-all">
            {image.file.name}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-label text-[11px] uppercase tracking-wider text-on-surface-variant">
            Size
          </dt>
          <dd className="font-body text-sm text-on-surface">{image.sizeLabel}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-label text-[11px] uppercase tracking-wider text-on-surface-variant">
            Beverage type
          </dt>
          <dd>
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full font-label text-sm font-bold">
              {BEVERAGE_LABELS[beverage]}
            </span>
          </dd>
        </div>
      </dl>

      <p className="mt-auto pt-6 border-t border-outline-variant/15 text-xs text-on-surface-variant leading-relaxed flex items-center gap-2 flex-wrap">
        <span>Nothing is stored. Inputs and results are discarded when you leave.</span>
        <InfoAnchor anchorKey="no-persistence" placement="bottom" />
      </p>
    </aside>
  );
}
