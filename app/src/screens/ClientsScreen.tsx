import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useApp } from '../context/AppContext';

interface ClientsScreenProps {
  navigation: any;
}

export default function ClientsScreen({ navigation }: ClientsScreenProps) {
  const { clients, deleteClient, getClientProjects } = useApp();
  const [search, setSearch] = useState('');

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Delete Client',
      `Are you sure you want to delete ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteClient(id) },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Clients</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddClient')}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search clients..."
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>
              {clients.length === 0 ? 'No clients yet' : 'No results found'}
            </Text>
            <Text style={styles.emptyText}>
              {clients.length === 0
                ? 'Tap "+ Add" to add your first client'
                : 'Try a different search term'}
            </Text>
          </View>
        )}

        {filtered.map((client) => {
          const projectCount = getClientProjects(client.id).length;
          return (
            <TouchableOpacity
              key={client.id}
              style={styles.clientCard}
              onPress={() => navigation.navigate('AddClient', { clientId: client.id })}
              onLongPress={() => handleDelete(client.id, client.name)}
            >
              <View style={styles.clientAvatar}>
                <Text style={styles.clientInitials}>
                  {client.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </Text>
              </View>
              <View style={styles.clientInfo}>
                <Text style={styles.clientName}>{client.name}</Text>
                <Text style={styles.clientPhone}>{client.phone}</Text>
                {client.email ? (
                  <Text style={styles.clientEmail}>{client.email}</Text>
                ) : null}
              </View>
              <View style={styles.clientStats}>
                <Text style={styles.clientProjects}>{projectCount}</Text>
                <Text style={styles.clientProjectsLabel}>projects</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    backgroundColor: '#fff',
    margin: 20,
    marginBottom: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  clientCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  },
  clientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1a73e8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  clientInitials: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  clientPhone: {
    fontSize: 14,
    color: '#666',
  },
  clientEmail: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  clientStats: {
    alignItems: 'center',
  },
  clientProjects: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a73e8',
  },
  clientProjectsLabel: {
    fontSize: 12,
    color: '#666',
  },
});
