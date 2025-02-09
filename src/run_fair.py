# %%
import numpy as np
import pandas as pd
from fair import FAIR
from fair.io import read_properties
from fair.interface import fill, initialise


# %%
DEFAULT_SCENARIO = 'ssp245'
EBM_CONFIG = 'files/4xCO2_cummins_ebm3.csv'
VOLCANIC_FORCING = 'files/volcanic_ERF_monthly_175001-201912.csv'
df = pd.read_csv(EBM_CONFIG)
DEFAULT_ESMs = df['model'].unique()


def get_ebm_configs(esms):
    ebm_configs = []
    for model in esms:
        for run in df.loc[df['model']==model, 'run']:
            ebm_configs.append(f"{model}_{run}")
    return ebm_configs


# %%

def initialise_fair(default_scenario=DEFAULT_SCENARIO, esms=DEFAULT_ESMs):
    # Instantiate FaIR model
    f = FAIR(ghg_method="meinshausen2020", ch4_method='thornhill2021')
    f.define_time(1750, 2101, 1)

    # Load energy balance model configs tuned against 66 different ESMs
    configs = get_ebm_configs([x.split()[0] for x in esms])
    f.define_configs(configs)

    # Define species we work with (meinshausen2020 method requires CH4 and N2O)
    species = ['CO2', 'CH4', 'N2O', 'Sulfur', 'BC', 'Volcanic']
    properties = {s: read_properties()[1][s] for s in species}
    properties['CO2']['input_mode'] = 'emissions'
    f.define_species(species, properties)

    # Load emission data 1750-2000 by querying an arbitrary scenario
    f.define_scenarios([default_scenario])
    f.allocate()
    f.fill_from_rcmip()

    # Load prescribed volcanic forcing for 1750-2000
    df_volcanic = pd.read_csv(VOLCANIC_FORCING, index_col='year')
    volcanic_forcing = np.zeros(352)
    volcanic_forcing[:271] = df_volcanic.loc[1749:].groupby(np.ceil(df_volcanic.loc[1749:].index) // 1).mean().squeeze().values
    fill(f.forcing, volcanic_forcing[:, None, None], specie="Volcanic")

    # Load species config for gas cycle and radiative forcing models
    f.fill_species_configs()

    # Initialise variable at starting point
    initialise(f.concentration, f.species_configs['baseline_concentration'])
    initialise(f.forcing, 0)
    initialise(f.temperature, 0)
    initialise(f.cumulative_emissions, 0)
    initialise(f.airborne_emissions, 0)

    # Rename all the scenario fields to 'custom' in the xarray attributes
    f.define_scenarios(["custom"])
    f.emissions = f.emissions.assign_coords(scenario=f.scenarios)
    f.cumulative_emissions = f.cumulative_emissions.assign_coords(scenario=f.scenarios)
    f.concentration = f.concentration.assign_coords(scenario=f.scenarios)
    f.forcing = f.forcing.assign_coords(scenario=f.scenarios)
    f.temperature = f.temperature.assign_coords(scenario=f.scenarios)

    # Load each set of energy balance model configs
    seed = 1355763
    for config in configs:
        model, run = config.split('_')
        condition = (df['model']==model) & (df['run']==run)
        fill(f.climate_configs['ocean_heat_capacity'], df.loc[condition, 'C1':'C3'].values.squeeze(), config=config)
        fill(f.climate_configs['ocean_heat_transfer'], df.loc[condition, 'kappa1':'kappa3'].values.squeeze(), config=config)
        fill(f.climate_configs['deep_ocean_efficacy'], df.loc[condition, 'epsilon'].values[0], config=config)
        fill(f.climate_configs['gamma_autocorrelation'], df.loc[condition, 'gamma'].values[0], config=config)
        fill(f.climate_configs['sigma_eta'], df.loc[condition, 'sigma_eta'].values[0], config=config)
        fill(f.climate_configs['sigma_xi'], df.loc[condition, 'sigma_xi'].values[0], config=config)
        fill(f.climate_configs['stochastic_run'], False, config=config)
        fill(f.climate_configs['use_seed'], False, config=config)
        fill(f.climate_configs['seed'], seed, config=config)
        seed = seed + 399
    return f


# %%
def run(f, years, co2):
    # Replace CO2 emission with custom emissions
    co2Xconfigs = np.tile(co2, (len(f.configs), 1)).T[:, None, :]
    f.emissions.sel(specie='CO2', timepoints=slice(min(years), max(years) + 1))[:] = co2Xconfigs

    # Run fair for each set of energy balance model configs
    f.run()

    # Compute ECS
    ECS = round(f.ebms.ecs.mean().item(), 2)

    # Return GMST anomaly
    t0 = 1950
    t = list(range(t0, max(years) + 2))
    T = f.temperature.sel(timebounds=slice(t0, max(years) + 1)).loc[dict(scenario='custom', layer=0)].values
    Tbar = np.mean(T, axis=1)
    return t, T, Tbar, ECS


# # %%
# f = initialise_fair()


# # %%
# years = np.arange(2005, 2080)
# co2 = np.linspace(10, 0, len(years))
# t, T, Tbar = run_fair(f, years, co2)



# # %%
# # Plot ensemble response
# pl.plot(t,T,color="#ffaaaa")
# pl.plot(t,Tbar,color="#ff0000")
# pl.show()
# # %%
