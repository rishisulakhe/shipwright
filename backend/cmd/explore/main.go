package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
)

const (
	// The path to the local Docker Unix socket
	dockerSocketPath = "/var/run/docker.sock"
	// Using stable Docker API v1.44 endpoints
	containersAPIUrl = "http://localhost/v1.44/containers/json?all=true"
	imagesAPIUrl     = "http://localhost/v1.44/images/json"
)

// MainResponse defines the final unified JSON output structure
type MainResponse struct {
	Containers []json.RawMessage `json:"containers"`
	Images     []json.RawMessage `json:"images"`
}

func main() {
	// 1. Initialize an HTTP client configured to route traffic through the Unix socket file
	client := &http.Client{
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
				// Completely ignore network/addr arguments and dial the local socket file directly
				return net.Dial("unix", dockerSocketPath)
			},
		},
	}

	// 2. Fetch all containers (including stopped ones via all=true query parameter)
	containersData, err := fetchDockerData(client, containersAPIUrl)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error fetching containers: %v\n", err)
		os.Exit(1)
	}

	// 3. Fetch all images cached locally
	imagesData, err := fetchDockerData(client, imagesAPIUrl)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error fetching images: %v\n", err)
		os.Exit(1)
	}

	// 4. Combine arrays into a single unified schema response using json.RawMessage
	// to avoid decoding performance overhead before sending to stdout
	output := MainResponse{
		Containers: containersData,
		Images:     imagesData,
	}

	// 5. Beautifully format and indent the final JSON output
	prettyJSON, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error formatting final JSON payload: %v\n", err)
		os.Exit(1)
	}

	// Write payload output directly to stdout
	fmt.Println(string(prettyJSON))
}

// fetchDockerData performs the actual HTTP request and processes the raw JSON arrays
func fetchDockerData(client *http.Client, url string) ([]json.RawMessage, error) {
	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to execute HTTP socket connection: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("docker API returned non-200 code (%d): %s", resp.StatusCode, string(bodyBytes))
	}

	// Parse incoming payload array directly into slices of raw tokens
	var result []json.RawMessage
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed parsing engine JSON data payload: %w", err)
	}

	return result, nil
}