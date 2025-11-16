import { Atom, FlaskConical, Youtube, FileText, Sparkles, PlayCircle, ChevronRight } from 'lucide-react';
import type { AIToolResponse, ReactionComponentRole } from '../types';

interface Props {
  response: AIToolResponse;
}

const roleLabels: Record<ReactionComponentRole, string> = {
  reactant: 'Reactants',
  agent: 'Reagents / Agents',
  product: 'Products'
};

const ReactionComponentsList = ({ response }: { response: Extract<AIToolResponse, { type: 'reaction' }> }) => {
  if (!response.components?.length) {
    return null;
  }

  const groups = response.components.reduce<Record<ReactionComponentRole, typeof response.components>>(
    (acc, component) => {
      acc[component.role] = acc[component.role] ?? [];
      acc[component.role].push(component);
      return acc;
    },
    { reactant: [], agent: [], product: [] }
  );

  return (
    <div className="grid gap-3">
      {(Object.keys(groups) as ReactionComponentRole[]).map(role => {
        const items = groups[role];
        if (!items.length) return null;
        return (
          <div key={role} className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300 mb-2">
              {roleLabels[role]}
            </p>
            <div className="space-y-2">
              {items.map((component, index) => (
                <div
                  key={`${component.label ?? component.smiles ?? 'component'}-${index}`}
                  className="rounded-lg bg-slate-800/60 px-3 py-2 text-xs text-slate-200"
                >
                  <p className="font-semibold">{component.label ?? component.smiles ?? 'Unknown'}</p>
                  {component.smiles && (
                    <p className="font-mono text-[11px] text-slate-400 break-words">SMILES: {component.smiles}</p>
                  )}
                  {component.notes && (
                    <p className="text-[11px] text-slate-400 mt-1">{component.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ReactionMechanismList = ({ response }: { response: Extract<AIToolResponse, { type: 'reaction' }> }) => {
  if (!response.mechanismStages?.length) {
    return null;
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Mechanism overview</p>
      <div className="space-y-2">
        {response.mechanismStages.map(stage => (
          <div key={stage.label} className="rounded-lg border border-slate-700/40 bg-slate-900/30 px-3 py-2">
            <p className="text-xs font-semibold text-slate-200">{stage.label}</p>
            {stage.description && <p className="text-[11px] text-slate-400 mt-1">{stage.description}</p>}
            {stage.smiles?.length && (
              <p className="text-[11px] font-mono text-slate-500 mt-1">
                {stage.smiles.join(' · ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const MoleculeCard = ({ response }: { response: Extract<AIToolResponse, { type: 'molecule' }> }) => (
  <div className="rounded-2xl border border-cyan-700/50 bg-gradient-to-br from-slate-900 to-slate-950 p-4 space-y-4 shadow-lg shadow-cyan-900/30">
    <div className="flex items-center gap-3 text-cyan-200">
      <div className="rounded-xl bg-cyan-700/30 p-2">
        <Atom className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200/80">Molecule preview</p>
        <h4 className="font-semibold text-white text-sm">{response.title}</h4>
        {response.summary && <p className="text-xs text-cyan-100/70">{response.summary}</p>}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3 text-xs text-slate-200">
      {response.formula && (
        <div className="rounded-lg bg-slate-900/70 border border-slate-700/50 p-3">
          <p className="text-[11px] text-slate-400 mb-1">Formula</p>
          <p className="font-semibold">{response.formula}</p>
        </div>
      )}
      {response.molecularWeight && (
        <div className="rounded-lg bg-slate-900/70 border border-slate-700/50 p-3">
          <p className="text-[11px] text-slate-400 mb-1">Mol. Weight</p>
          <p className="font-semibold">{response.molecularWeight.toFixed(2)} g/mol</p>
        </div>
      )}
      {response.smiles && (
        <div className="rounded-lg bg-slate-900/70 border border-slate-700/50 p-3 col-span-2">
          <p className="text-[11px] text-slate-400 mb-1">SMILES</p>
          <p className="font-mono text-[11px] break-words">{response.smiles}</p>
        </div>
      )}
    </div>
    <div className="relative overflow-hidden rounded-xl border border-slate-800 shadow-inner">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-slate-950/40 to-transparent" />
      <iframe
        title={`molview-${response.id}`}
        src={response.embedUrl}
        className="w-full h-64 bg-slate-950"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  </div>
);

const ReactionCard = ({ response }: { response: Extract<AIToolResponse, { type: 'reaction' }> }) => (
  <div className="rounded-2xl border border-amber-600/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 space-y-4 shadow-lg shadow-amber-900/20">
    <div className="flex items-center gap-3 text-amber-100">
      <div className="rounded-xl bg-amber-600/30 p-2">
        <FlaskConical className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/80">Reaction insight</p>
        <h4 className="font-semibold text-sm">{response.title}</h4>
        {response.summary && <p className="text-xs text-amber-100/80">{response.summary}</p>}
      </div>
    </div>
    {response.reactionSvg && (
      <div className="rounded-xl border border-amber-700/40 bg-slate-950/70 p-3">
        <img
          src={response.reactionSvg}
          alt={`${response.title} reaction diagram`}
          className="w-full max-h-72 object-contain"
          loading="lazy"
        />
      </div>
    )}
    {response.reactionSmiles && (
      <div className="rounded-xl border border-amber-700/40 bg-slate-950/70 px-4 py-3">
        <p className="text-[11px] text-amber-200/80 mb-1">Reaction SMILES</p>
        <p className="font-mono text-xs text-amber-100 break-words">{response.reactionSmiles}</p>
      </div>
    )}
    <ReactionComponentsList response={response} />
    <ReactionMechanismList response={response} />
  </div>
);

const VideoCard = ({ response }: { response: Extract<AIToolResponse, { type: 'video' }> }) => (
  <div className="rounded-2xl border border-rose-600/50 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 space-y-4 shadow-lg shadow-rose-900/30">
    <div className="flex items-center gap-3 text-rose-100">
      <div className="rounded-xl bg-rose-600/30 p-2">
        <Youtube className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-100/80">Video queue</p>
        <h4 className="font-semibold text-sm">{response.title}</h4>
        {response.summary && <p className="text-xs text-rose-100/70">{response.summary}</p>}
      </div>
    </div>
    <div className="space-y-3">
      {response.videos.map(video => (
        <a
          className="flex gap-3 rounded-xl border border-rose-700/40 bg-slate-950/70 p-3 hover:bg-slate-900/80 transition-colors"
          key={video.id}
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {video.thumbnailUrl && (
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="w-28 h-20 rounded-lg object-cover flex-shrink-0"
              loading="lazy"
            />
          )}
          <div className="flex-1">
            <p className="text-sm font-semibold text-white line-clamp-2">{video.title}</p>
            <p className="text-xs text-rose-100/70 mt-1">{video.channelTitle}</p>
            <div className="mt-2 inline-flex items-center text-[11px] text-rose-100/70 gap-1">
              <PlayCircle className="h-3.5 w-3.5" />
              Watch on YouTube
            </div>
          </div>
        </a>
      ))}
    </div>
  </div>
);

const DocumentCard = ({ response }: { response: Extract<AIToolResponse, { type: 'document' }> }) => (
  <div className="rounded-2xl border border-emerald-600/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 space-y-4 shadow-lg shadow-emerald-900/30">
    <div className="flex items-center gap-3 text-emerald-100">
      <div className="rounded-xl bg-emerald-600/30 p-2">
        <FileText className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100/80">Document insights</p>
        <h4 className="font-semibold text-sm">{response.title}</h4>
        {response.sourceName && <p className="text-xs text-emerald-100/70">Source: {response.sourceName}</p>}
      </div>
    </div>
    <p className="text-sm text-emerald-50 leading-relaxed">{response.summary}</p>
    {response.keyTopics.length > 0 && (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100/80 mb-2">Key topics</p>
        <div className="flex flex-wrap gap-2">
          {response.keyTopics.map(topic => (
            <span key={topic} className="inline-flex items-center gap-1 rounded-full border border-emerald-600/60 px-3 py-1 text-[11px] font-semibold text-emerald-100">
              <Sparkles className="h-3 w-3" />
              {topic}
            </span>
          ))}
        </div>
      </div>
    )}
    {response.essentialConcepts.length > 0 && (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100/80">Essential concepts</p>
        <ul className="space-y-1 text-sm text-emerald-50/90">
          {response.essentialConcepts.map(concept => (
            <li key={concept} className="flex items-start gap-2 text-xs">
              <ChevronRight className="h-3 w-3 mt-0.5 text-emerald-300" />
              {concept}
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

const AIToolResponseCard = ({ response }: Props) => {
  switch (response.type) {
    case 'molecule':
      return <MoleculeCard response={response} />;
    case 'reaction':
      return <ReactionCard response={response} />;
    case 'video':
      return <VideoCard response={response} />;
    case 'document':
      return <DocumentCard response={response} />;
    default:
      return null;
  }
};

export default AIToolResponseCard;
