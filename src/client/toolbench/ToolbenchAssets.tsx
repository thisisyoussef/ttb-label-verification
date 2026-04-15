import { CSV_ASSETS, LABEL_IMAGE_ASSETS } from './toolbench-manifest';
import { ToolbenchAssetThumbnail } from './ToolbenchAssetThumbnail';

interface ToolbenchAssetsProps {
  onLoadImage: (file: File) => void;
  onLoadCsv: (file: File) => void;
}

const SECTION_HEADER = 'font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant';

export function ToolbenchAssets({ onLoadImage, onLoadCsv }: ToolbenchAssetsProps) {
  return (
    <div className="h-full overflow-y-auto p-3 flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <div>
          <p className={SECTION_HEADER}>Label Images</p>
          <p className="text-[10px] font-body text-on-surface-variant mt-0.5">
            Drag onto a drop zone or click the arrow to load directly.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {LABEL_IMAGE_ASSETS.map((asset) => (
            <ToolbenchAssetThumbnail
              key={asset.id}
              name={asset.name}
              description={asset.description}
              url={asset.url}
              filename={asset.filename}
              onLoad={onLoadImage}
              kind="image"
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <p className={SECTION_HEADER}>CSV Files</p>
        <div className="flex flex-col gap-1.5">
          {CSV_ASSETS.map((asset) => (
            <ToolbenchAssetThumbnail
              key={asset.id}
              name={asset.name}
              description={asset.description}
              url={asset.url}
              filename={asset.filename}
              onLoad={onLoadCsv}
              kind="csv"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
