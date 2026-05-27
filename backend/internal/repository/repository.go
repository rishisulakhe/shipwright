package repository

import "database/sql"

type Repositories struct {
	Users      UserRepository
	Hosts      HostRepository
	Containers ContainerRepository
	Networks   NetworkRepository
	Volumes    VolumeRepository
	Images     ImageRepository
}

func NewRepositories(db *sql.DB) *Repositories {
	return &Repositories{
		Users:      NewUserRepo(db),
		Hosts:      NewHostRepo(db),
		Containers: NewContainerRepo(db),
		Networks:   NewNetworkRepo(db),
		Volumes:    NewVolumeRepo(db),
		Images:     NewImageRepo(db),
	}
}
