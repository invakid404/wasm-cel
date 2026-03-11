package options

import (
	"fmt"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/ext"
)

// MathExtBuilder configures the CEL math extension library.
// This extension provides namespaced math helper macros and functions such as
// math.greatest, math.least, math.ceil, math.floor, math.round, math.trunc,
// math.abs, math.sign, math.isNaN, math.isInf, math.isFinite, and bitwise operations.
type MathExtBuilder struct {
	Version *uint32
}

// Name returns the name of this option
func (b *MathExtBuilder) Name() string {
	return "MathExt"
}

// Description returns the description of this option
func (b *MathExtBuilder) Description() string {
	return "MathExt enables the CEL math extension library, providing namespaced math helper macros and functions such as math.greatest, math.least, math.ceil, math.floor, math.round, math.trunc, math.abs, math.sign, math.isNaN, math.isInf, math.isFinite, math.sqrt, and bitwise operations."
}

// Build creates the CEL environment option
func (b *MathExtBuilder) Build() (cel.EnvOption, error) {
	var opts []ext.MathOption

	if b.Version != nil {
		opts = append(opts, ext.MathVersion(*b.Version))
	}

	return ext.Math(opts...), nil
}

// FromJSON configures the MathExtBuilder from JSON parameters
func (b *MathExtBuilder) FromJSON(params map[string]interface{}) error {
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
	DefaultRegistry.Register("MathExt", func() OptionBuilder {
		return &MathExtBuilder{}
	})
}
