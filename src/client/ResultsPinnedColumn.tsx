import { InfoAnchor } from './InfoAnchor';
import { LabelImageGallery } from './LabelImageGallery';
import type { BeverageType } from '../shared/contracts/review';
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
  secondaryImage?: LabelImage | null;
  beverage: BeverageSelection;
  detectedBeverage?: BeverageType;
}

export function ResultsPinnedColumn({
  image,
  secondaryImage = null,
  beverage,
  detectedBeverage
}: ResultsPinnedColumnProps) {
  const displayBeverage: BeverageSelection =
    beverage === 'auto' && detectedBeverage ? detectedBeverage : beverage;

  return (
    <aside className="md:col-span-5 lg:col-span-4 flex flex-col overflow-y-auto border-r border-outline-variant/15 bg-surface-container-low">
      <div className="sticky top-0 z-10 flex flex-col gap-4 p-4 pb-0 lg:p-6 lg:pb-0 xl:p-8 xl:pb-0">
        <h2 className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
          Label details
        </h2>

        <LabelImageGallery
          primaryImage={image}
          secondaryImage={secondaryImage}
          variant="results"
        />
      </div>

      <dl className="flex flex-col gap-3 p-4 pt-4 lg:px-6 xl:px-8">
        <div className="flex items-center gap-3">
          <dt className="w-16 shrink-0 font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
            Images
          </dt>
          <dd className="text-sm font-semibold text-on-surface">
            {secondaryImage ? '2 attached' : '1 attached'}
          </dd>
        </div>
        <div className="flex items-start gap-3">
          <dt className="w-16 shrink-0 pt-0.5 font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
            Files
          </dt>
          <dd className="min-w-0 flex-1 space-y-1">
            <p className="break-all font-mono text-xs font-semibold text-on-surface">
              {image.file.name}
            </p>
            {secondaryImage ? (
              <p className="break-all font-mono text-xs font-semibold text-on-surface">
                {secondaryImage.file.name}
              </p>
            ) : null}
          </dd>
        </div>
        <div className="flex items-center gap-3">
          <dt className="w-16 shrink-0 font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
            Type
          </dt>
          <dd>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-2.5 py-0.5 font-label text-xs font-bold text-on-secondary-container">
              {BEVERAGE_LABELS[displayBeverage]}
              {beverage === 'auto' && detectedBeverage ? (
                <span className="font-label text-[9px] font-bold uppercase tracking-widest text-on-secondary-container/70">
                  detected
                </span>
              ) : null}
            </span>
          </dd>
        </div>
      </dl>

      <p className="mt-auto flex flex-wrap items-center gap-2 border-t border-outline-variant/15 p-4 pt-4 text-xs leading-relaxed text-on-surface-variant lg:px-6 xl:px-8">
        <span>Nothing is stored. Inputs and results are discarded when you leave.</span>
        <InfoAnchor anchorKey="no-persistence" placement="bottom" />
      </p>
    </aside>
  );
}
