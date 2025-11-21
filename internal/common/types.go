package common

// ValidatorIssue represents an issue from custom validators
type ValidatorIssue struct {
	Severity string                 `json:"severity"`
	Message  string                 `json:"message"`
	Location map[string]interface{} `json:"location,omitempty"`
}

// CompilationIssueAdder defines the interface for adding validator issues during compilation
type CompilationIssueAdder interface {
	AddValidatorIssue(issue ValidatorIssue)
}

// CompilationIssueProvider defines the interface for retrieving validator issues after compilation
type CompilationIssueProvider interface {
	GetValidatorIssues() []ValidatorIssue
}

// CompilationIssueCollector combines both adding and retrieving validator issues
type CompilationIssueCollector interface {
	CompilationIssueAdder
	CompilationIssueProvider
}
