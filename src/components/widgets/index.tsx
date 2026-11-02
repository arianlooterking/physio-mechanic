import type { WidgetName } from '../../content/types';
import type { BaseName } from '../../lib/fns';
import { SeriesLab, TangentLab } from './CalcLabs';
import { InscribedLab, MatrixLab, SystemLab } from './GeoLabs';
import { TruthLab } from './LogicLabs';
import { IntervalLab, NumberLine, VennLab } from './SetLabs';
import { GrowLab, PatternLab } from './SeqLabs';
import { HardWaterLab, IonLab, MixturesLab, OxideLab, PhLab, SoapLab, TrendsLab } from './ChemLabs';
import { CubeCompare } from './CubeCompare';
import { DivisionLab } from './DivisionLab';
import { MonotoneLab } from './MonotoneLab';
import { AccelMotion, ConstantVelocity, CoulombLab, FreeFall, MotionLab, SlopeLab } from './PhysicsLabs';
import { TransformLab } from './TransformLab';
import { TrigLab } from './TrigLabs';
import { GcdLab, IntDivLab } from './NumberLabs';
import { CongruenceLab, DiophantineLab } from './CongruenceLabs';
import { DominationLab, GraphLab } from './GraphLabs';
import { LatinLab, StarsBarsLab } from './CombLabs';
import { InclusionLab, PigeonLab } from './CountingLabs';
import { AverageMassLab, DensityLab, IsotopeLab, MagnitudeLab, PrecisionLab, RightTriangleLab, ShellsLab, UnitCircleLab, UnitsLab } from './Grade10Labs';

export function Widget({ name, props = {} }: { name: WidgetName; props?: Record<string, unknown> }) {
  switch (name) {
    case 'transform':
      return (
        <TransformLab
          mode={props.mode as 'vshift' | 'hshift' | 'vscale' | 'hscale' | 'combo'}
          base={props.base as BaseName | undefined}
          bases={props.bases as BaseName[] | undefined}
        />
      );
    case 'monotone':
      return <MonotoneLab preset={props.preset as 'book' | 'sq' | 'exp' | 'step' | undefined} />;
    case 'cubeCompare':
      return <CubeCompare />;
    case 'division':
      return <DivisionLab />;
    case 'motion':
      return <MotionLab graph={Boolean(props.graph)} />;
    case 'slope':
      return <SlopeLab kind={(props.kind as 'x' | 'v' | undefined) ?? 'x'} />;
    case 'constantVelocity':
      return <ConstantVelocity />;
    case 'soap':
      return <SoapLab />;
    case 'mixtures':
      return <MixturesLab />;
    case 'hardWater':
      return <HardWaterLab />;
    case 'ions':
      return <IonLab />;
    case 'oxides':
      return <OxideLab />;
    case 'accel':
      return <AccelMotion />;
    case 'freeFall':
      return <FreeFall />;
    case 'tangent':
      return <TangentLab />;
    case 'ph':
      return <PhLab />;
    case 'matrix':
      return <MatrixLab />;
    case 'trig':
      return <TrigLab />;
    case 'system':
      return <SystemLab />;
    case 'trends':
      return <TrendsLab />;
    case 'coulomb':
      return <CoulombLab />;
    case 'truth':
      return <TruthLab />;
    case 'inscribed':
      return <InscribedLab />;
    case 'interval':
      return <IntervalLab />;
    case 'numline':
      return <NumberLine parts={props.parts as [number, number, boolean, boolean][]} x={props.x as [number, number] | undefined} />;
    case 'venn':
      return <VennLab />;
    case 'pattern':
      return <PatternLab />;
    case 'grow':
      return <GrowLab />;
    case 'series':
      return <SeriesLab mode={props.mode as 'gauss' | 'geo' | undefined} />;
    case 'intdiv':
      return <IntDivLab mode={props.mode as 'groups' | 'line' | 'classes' | undefined} />;
    case 'gcd':
      return <GcdLab />;
    case 'congruence':
      return <CongruenceLab mode={props.mode as 'clock' | 'week' | undefined} />;
    case 'diophantine':
      return <DiophantineLab />;
    case 'graph':
      return <GraphLab preset={props.preset as string | undefined} tool={props.tool as 'edit' | 'path' | undefined} />;
    case 'domination':
      return <DominationLab preset={props.preset as string | undefined} />;
    case 'starsbars':
      return <StarsBarsLab n={props.n as number | undefined} k={props.k as number | undefined} />;
    case 'latin':
      return <LatinLab mode={props.mode as 'single' | 'pair' | undefined} />;
    case 'inclusion':
      return <InclusionLab mode={props.mode as 'sport' | 'divis' | undefined} />;
    case 'pigeon':
      return <PigeonLab />;
    case 'units':
      return <UnitsLab />;
    case 'precision':
      return <PrecisionLab />;
    case 'density':
      return <DensityLab />;
    case 'magnitude':
      return <MagnitudeLab />;
    case 'isotope':
      return <IsotopeLab />;
    case 'avgMass':
      return <AverageMassLab />;
    case 'shells':
      return <ShellsLab />;
    case 'rightTri':
      return <RightTriangleLab />;
    case 'unitCircle':
      return <UnitCircleLab />;
  }
}
