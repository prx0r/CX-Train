'use client';

import ServiceDeskSimulatorShell, {
  type ShellProps,
} from '@/components/mvp/simulator/ServiceDeskSimulatorShell';
import HiringWorkspace from '@/components/mvp/workspace/HiringWorkspace';
import type { ModeConfig, WorkspaceMode } from '@/lib/mvp/workspace/types';

export interface SimulationWorkspaceProps extends ShellProps {
  mode?: WorkspaceMode;
  modeConfig?: ModeConfig;
  hiringPack?: {
    id: string;
    title: string;
    customer: {
      name: string;
      company: string;
      openingLine: string;
      issue: string;
      role: string;
      temperament: string;
    };
  };
}

export default function SimulationWorkspace({
  mode,
  modeConfig: _modeConfig,
  hiringPack,
  ...shellProps
}: SimulationWorkspaceProps) {
  if (mode === 'hiring' || shellProps.assignmentType === 'hiring_exam') {
    return (
      <HiringWorkspace
        token={shellProps.token}
        mode={shellProps.assignmentType}
        initialMessages={shellProps.initialMessages}
        initialAnalysis={shellProps.initialAnalysis}
        hiringPack={hiringPack}
        ticket={shellProps.ticket}
      />
    );
  }

  return <ServiceDeskSimulatorShell {...shellProps} />;
}
