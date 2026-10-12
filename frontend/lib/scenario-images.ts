/**
 * Scenario illustrations (Steps 11-13 visual pass).
 *
 * These are AI-generated concept-art illustrations created to help visualize
 * what each simulated scenario *might* look like — a Mars-transit habitat, an
 * EVA, crew sleep quarters, the debate chamber, the spacecraft itself. They
 * are synthetic digital art, not real NASA photography, exactly like the
 * crew profiles and mission events the rest of the app is built on. Every
 * place one of these is used, the UI carries a visible "synthetic
 * illustration" caption — see <ScenarioCaption /> in components/Banner.tsx —
 * so nobody mistakes concept art for a real mission photo.
 *
 * They are currently hotlinked to the CDN they were generated on, because
 * this build environment's network policy blocks outbound downloads from
 * that host. For a fully self-hosted / offline build, download the five
 * URLs below and save them under /public/images/<name>.jpg, then switch
 * each path here to "/images/<name>.jpg".
 */

export const SCENARIO_IMAGES = {
  heroHabitat:
    "https://d8j0ntlcm91z4.cloudfront.net/user_3DrUkfepeVhQuUCyiIycTyQT1DU/hf_20261012_041151_e72aa0e0-357e-4844-9dfb-e18ea4f96cb3.png",
  evaSpacewalk:
    "https://d8j0ntlcm91z4.cloudfront.net/user_3DrUkfepeVhQuUCyiIycTyQT1DU/hf_20261012_041239_27661983-f42b-4f80-9de0-0db4ece34f07.png",
  sleepQuarters:
    "https://d8j0ntlcm91z4.cloudfront.net/user_3DrUkfepeVhQuUCyiIycTyQT1DU/hf_20261012_041333_32a0eaca-8a7e-48c2-b06a-9d9cf2ab5c0e.png",
  debateChamber:
    "https://d8j0ntlcm91z4.cloudfront.net/user_3DrUkfepeVhQuUCyiIycTyQT1DU/hf_20261012_041057_5f92fed4-8d0f-4d22-bad0-9291b7d948b1.png",
  spacecraftExterior:
    "https://d8j0ntlcm91z4.cloudfront.net/user_3DrUkfepeVhQuUCyiIycTyQT1DU/hf_20261012_041427_2301185d-d639-425b-8eda-855bdae99ecd.png",
} as const;
