package options

// FromJSON configures the CrossTypeNumericComparisonsBuilder from JSON parameters
func (b *CrossTypeNumericComparisonsBuilder) FromJSON(params map[string]interface{}) error {
	// Default to enabled if no explicit value is provided
	enabled := true
	
	// Check if enabled parameter is provided
	if enabledParam, exists := params["enabled"]; exists {
		if enabledBool, ok := enabledParam.(bool); ok {
			enabled = enabledBool
		}
	}
	
	b.SetEnabled(enabled)
	return nil
}