<?php

namespace App\Filament\Resources;

use App\Filament\Resources\PlatformConfigResource\Pages;
use App\Filament\Resources\PlatformConfigResource\RelationManagers;
use App\Models\PlatformConfig;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;

class PlatformConfigResource extends Resource
{
    protected static ?string $model = PlatformConfig::class;

    protected static ?string $navigationIcon = 'heroicon-o-rectangle-stack';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Toggle::make('is_master_switch_on')
                    ->required(),
                Forms\Components\TextInput::make('platform_name')
                    ->required()
                    ->maxLength(255)
                    ->default('SmartKiosk'),
                Forms\Components\TextInput::make('support_email')
                    ->email()
                    ->maxLength(255),
                Forms\Components\TextInput::make('support_whatsapp')
                    ->maxLength(255),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\IconColumn::make('is_master_switch_on')
                    ->boolean(),
                Tables\Columns\TextColumn::make('platform_name')
                    ->searchable(),
                Tables\Columns\TextColumn::make('support_email')
                    ->searchable(),
                Tables\Columns\TextColumn::make('support_whatsapp')
                    ->searchable(),
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('updated_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                //
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListPlatformConfigs::route('/'),
            'create' => Pages\CreatePlatformConfig::route('/create'),
            'edit' => Pages\EditPlatformConfig::route('/{record}/edit'),
        ];
    }
}
