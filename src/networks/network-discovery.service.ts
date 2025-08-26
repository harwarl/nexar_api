import { Injectable, Logger } from '@nestjs/common';
import { Network } from './network.interface';
import { ProvidersService } from 'src/providers/providers.service';

@Injectable()
export class NetworkDiscoveryService {
  private readonly logger = new Logger(NetworkDiscoveryService.name);
  private readonly discoveredNetworks: Map<string, Network> = new Map();
  private networkIdCounter = 1;

  constructor(private readonly providerService: ProvidersService) {}

  async discoverNetworks(): Promise<Network[]> {
    const providers = this.providerService.getAllProviders();

    for (const provider of providers) {
      await this.discoverNetworksFromProvider(provider);
    }

    return Array.from(this.discoveredNetworks.values());
  }

  // Discover the networks from the provider
  private async discoverNetworksFromProvider(provider: any): Promise<void> {
    try {
      const tokens = await provider.fetchSupportedTokens();

      for (const token of tokens) {
        const networkSlug = this.normalizeNetworkSlug(token.network);

        if (!this.discoveredNetworks.has(networkSlug)) {
          this.createNetworkFromProvider(
            networkSlug,
            token.network,
            provider.name,
          );
        } else {
          // Update the existing network
          this.updateExistingNetwork(
            networkSlug,
            token.network,
            provider.name,
            token.alias,
          );
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to discover networks from ${provider.name}: ${error.message}`,
      );
    }
  }

  private updateExistingNetwork(
    slug: string,
    originalName: string,
    providerName: string,
    alias?: string,
  ): void {
    const existingNetwork = this.discoveredNetworks.get(slug);

    if (!existingNetwork) return;

    console.log('Aliases');
    console.log(existingNetwork.aliases);
    console.log(alias);
    // Add the alias if it doesn't exist
    if (alias && !existingNetwork.aliases.includes(alias)) {
      existingNetwork.aliases.push(alias);
      this.logger.log(`Added Alias "${originalName}" to network`);
    }

    // Update provider symbol
    const providerSymbolKey = `ticker_${providerName}` as keyof Network;
    if (providerSymbolKey in existingNetwork) {
      (existingNetwork as any)[providerSymbolKey] = originalName;
    }

    // Update the network in the map
    this.discoveredNetworks.set(slug, existingNetwork);
  }

  private normalizeNetworkSlug(networkName: string): string {
    return networkName.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  private createNetworkFromProvider(
    slug: string,
    originalName: string,
    providerName: string,
  ): void {
    const network: Network = {
      id: this.networkIdCounter++,
      slug: slug,
      name: this.formatNetworkName(originalName),
      aliases: [originalName, slug],
      // Initialize all provider symbols as null
      ticker_fixedfloat: null,
      ticker_changehero: null,
      ticker_changenow: null,
      ticker_sideshift: null,
      ticker_simpleswap: null,
      ticker_swapuz: null,
      ticker_thechange: null,
      ticker_exolix: null,
      ticker_swaponix: null,
      ticker_nanswap: null,
      ticker_changelly: null,
    };

    // Set provider's symbol for this network
    const providerSymbolKey = `ticker_${providerName}` as keyof Network;
    if (providerSymbolKey in network) {
      (network as any)[providerSymbolKey] = originalName;
    }

    this.discoveredNetworks.set(slug, network);
    this.logger.log(`Discovered new network: ${slug} from ${providerName}`);
  }

  private formatNetworkName(originalName: string): string {
    // COnvert "BSC" to "Bsc", "ETH" to "Eth", etc
    return (
      originalName.charAt(0).toUpperCase() + originalName.slice(1).toLowerCase()
    );
  }

  // Find Network by slug
  findNetworkBySlug(slug: string): Network | undefined {
    return this.discoveredNetworks.get(slug);
  }

  // Find Network by alias
  findNetworkByAlias(alias: string): Network | undefined {
    const normalizedAlias = this.normalizeNetworkSlug(alias);
    return Array.from(this.discoveredNetworks.values()).find((network) =>
      network.aliases.some(
        (a) => this.normalizeNetworkSlug(a) === normalizedAlias,
      ),
    );
  }

  // Get All Networks
  getAllNetworks(): Network[] {
    return Array.from(this.discoveredNetworks.values());
  }
}
