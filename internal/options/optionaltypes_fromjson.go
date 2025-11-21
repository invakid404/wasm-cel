package options

// FromJSON configures the OptionalTypesBuilder from JSON parameters
func (b *OptionalTypesBuilder) FromJSON(params map[string]interface{}) error {
	// OptionalTypes doesn't require any parameters for basic functionality
	// In a more complex implementation, you could parse params to configure
	// specific OptionalTypesOptions, but for now we'll use the defaults
	return nil
}