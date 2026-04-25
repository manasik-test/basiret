declare module "webgl-fluid" {
  interface FluidConfig {
    IMMEDIATE?: boolean;
    TRIGGER?: string;
    SIM_RESOLUTION?: number;
    DYE_RESOLUTION?: number;
    CAPTURE_RESOLUTION?: number;
    DENSITY_DISSIPATION?: number;
    VELOCITY_DISSIPATION?: number;
    PRESSURE?: number;
    PRESSURE_ITERATIONS?: number;
    CURL?: number;
    SPLAT_RADIUS?: number;
    SPLAT_FORCE?: number;
    SHADING?: boolean;
    COLOR_UPDATE_SPEED?: number;
    BACK_COLOR?: { r: number; g: number; b: number };
    TRANSPARENT?: boolean;
    BLOOM?: boolean;
    BLOOM_ITERATIONS?: number;
    SUNRAYS?: boolean;
    COLOR_PALETTE?: string[];
  }
  export default function fluidInit(
    canvas: HTMLCanvasElement,
    config?: FluidConfig
  ): void;
}
