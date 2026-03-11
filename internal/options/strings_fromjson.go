package options

import (
	"fmt"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/ext"
)

// StringsExtBuilder configures the CEL string extension library.
// This extension provides additional string manipulation functions such as
// charAt, indexOf, join, lowerAscii, upperAscii, replace, split, substring, trim, and more.
type StringsExtBuilder struct {
	Version             *uint32
	Locale              *string
	ValidateFormatCalls *bool
}

// Name returns the name of this option
func (b *StringsExtBuilder) Name() string {
	return "StringsExt"
}

// Description returns the description of this option
func (b *StringsExtBuilder) Description() string {
	return "StringsExt enables the CEL string extension library, providing additional string manipulation functions such as charAt, indexOf, join, lowerAscii, upperAscii, replace, split, substring, trim, format, reverse, and more."
}

// Build creates the CEL environment option
func (b *StringsExtBuilder) Build() (cel.EnvOption, error) {
	var opts []ext.StringsOption

	if b.Version != nil {
		opts = append(opts, ext.StringsVersion(*b.Version))
	}
	if b.Locale != nil {
		opts = append(opts, ext.StringsLocale(*b.Locale))
	}
	if b.ValidateFormatCalls != nil {
		opts = append(opts, ext.StringsValidateFormatCalls(*b.ValidateFormatCalls))
	}

	return ext.Strings(opts...), nil
}

// FromJSON configures the StringsExtBuilder from JSON parameters
func (b *StringsExtBuilder) FromJSON(params map[string]interface{}) error {
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

	if localeParam, exists := params["locale"]; exists {
		if locale, ok := localeParam.(string); ok {
			b.Locale = &locale
		} else {
			return fmt.Errorf("locale must be a string")
		}
	}

	if validateParam, exists := params["validateFormatCalls"]; exists {
		if validate, ok := validateParam.(bool); ok {
			b.ValidateFormatCalls = &validate
		} else {
			return fmt.Errorf("validateFormatCalls must be a boolean")
		}
	}

	return nil
}

func init() {
	DefaultRegistry.Register("StringsExt", func() OptionBuilder {
		return &StringsExtBuilder{}
	})
}
