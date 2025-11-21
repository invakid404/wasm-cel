package wasmenv

import (
	"encoding/json"
	"fmt"

	"github.com/google/cel-go/cel"
	"github.com/invakid404/wasm-cel/internal/options"
)

// OptionConfig represents a configuration for a CEL environment option
type OptionConfig struct {
	Type   string                 `json:"type"`
	Params map[string]interface{} `json:"params,omitempty"`
}

// CreateOptionsFromJSON creates CEL environment options from JSON configuration
// Uses the registry to find options that implement FromJSON interface
func CreateOptionsFromJSON(configJSON string) ([]cel.EnvOption, error) {
	return CreateOptionsFromJSONWithEnvID(configJSON, "")
}

// CreateOptionsFromJSONWithEnvID creates CEL environment options from JSON configuration with environment ID
// Uses the registry to find options that implement FromJSON interface
func CreateOptionsFromJSONWithEnvID(configJSON string, envID string) ([]cel.EnvOption, error) {
	var configs []OptionConfig
	if err := json.Unmarshal([]byte(configJSON), &configs); err != nil {
		return nil, fmt.Errorf("failed to parse options configuration: %w", err)
	}

	var envOptions []cel.EnvOption
	for _, config := range configs {
		// Create builder from registry
		builder, err := options.DefaultRegistry.Create(config.Type)
		if err != nil {
			return nil, fmt.Errorf("failed to create option %s: %w", config.Type, err)
		}

		// Check if the builder implements FromJSON
		fromJSONBuilder, ok := builder.(options.FromJSON)
		if !ok {
			return nil, fmt.Errorf("option %s does not support JSON configuration", config.Type)
		}

		// Configure the builder from JSON parameters
		if err := fromJSONBuilder.FromJSON(config.Params); err != nil {
			return nil, fmt.Errorf("failed to configure option %s from JSON: %w", config.Type, err)
		}

		// Set environment ID if the builder supports it
		if envIDAware, ok := builder.(interface{ SetEnvID(string) }); ok && envID != "" {
			envIDAware.SetEnvID(envID)
		}

		// Build the CEL environment option
		option, err := builder.Build()
		if err != nil {
			return nil, fmt.Errorf("failed to build option %s: %w", config.Type, err)
		}

		envOptions = append(envOptions, option)
	}

	return envOptions, nil
}

// ListAvailableOptions returns the names of all options that support FromJSON
func ListAvailableOptions() []string {
	return options.DefaultRegistry.ListWithFromJSON()
}