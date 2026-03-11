package options

import (
	"fmt"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/ext"
)

// EncodersExtBuilder configures the CEL encoders extension library.
// This extension provides functions for string, byte, and object encodings
// such as base64.encode and base64.decode.
type EncodersExtBuilder struct {
	Version *uint32
}

// Name returns the name of this option
func (b *EncodersExtBuilder) Name() string {
	return "EncodersExt"
}

// Description returns the description of this option
func (b *EncodersExtBuilder) Description() string {
	return "EncodersExt enables the CEL encoders extension library, providing functions for string, byte, and object encodings such as base64.encode and base64.decode."
}

// Build creates the CEL environment option
func (b *EncodersExtBuilder) Build() (cel.EnvOption, error) {
	var opts []ext.EncodersOption

	if b.Version != nil {
		opts = append(opts, ext.EncodersVersion(*b.Version))
	}

	return ext.Encoders(opts...), nil
}

// FromJSON configures the EncodersExtBuilder from JSON parameters
func (b *EncodersExtBuilder) FromJSON(params map[string]interface{}) error {
	if params == nil {
		return nil
	}

	if versionParam, exists := params["version"]; exists {
		switch v := versionParam.(type) {
		case float64:
			version := uint32(v)
			b.Version = &version
		default:
			return fmt.Errorf("version must be a number")
		}
	}

	return nil
}

func init() {
	DefaultRegistry.Register("EncodersExt", func() OptionBuilder {
		return &EncodersExtBuilder{}
	})
}
